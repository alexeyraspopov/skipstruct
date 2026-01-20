/**
 * Fixed capacity skip list. It doesn't contain the values, it uses numeric keys to maintain the
 * order of values (defined by the comparator). Fixed data structure allocates memory in advance
 * so it is most suitable for cases where constant volume of data is expected.
 */
export class FixedSkipList {
  /**
   * @param {number} capacity maximum number of values that can be stored in the list
   * @param {number} ratio probability of promoting a value to next layer; defines size ratio between layers; should be more than 0 and less than 1; most commonly used values are 1/2, 1/4, 1/8.
   * @param {(a: number, b: number) => -1 | 0 | 1} compare comparator function that receives indices of values
   */
  constructor(capacity, ratio, compare) {
    /** @type {number} */
    this.capacity = capacity;
    /** @type {number} */
    this.ratio = ratio;
    /** @type {(a: number, b: number) => -1 | 0 | 1} */
    this.compare = compare;

    /** @protected */
    this.currentLevel = 0;

    let maxLevel = Math.floor(Math.log(capacity) / Math.log(1 / ratio)) + 1;
    let metalength = maxLevel * Uint32Array.BYTES_PER_ELEMENT;
    let metas = new ArrayBuffer(3 * metalength);
    /**
     * @protected
     * @type {Uint32Array}
     */
    this.heads = new Uint32Array(metas, 0 * metalength, maxLevel);
    /**
     * @protected
     * @type {Uint32Array}
     */
    this.tails = new Uint32Array(metas, 1 * metalength, maxLevel);
    /**
     * @protected
     * @type {Uint32Array}
     */
    this.sizes = new Uint32Array(metas, 2 * metalength, maxLevel);

    /**
     * @protected
     * @type {() => number}
     */
    this.randomLevel = randomLevelGenerator(maxLevel - 1, ratio);

    let lanelength = capacity * Uint32Array.BYTES_PER_ELEMENT;
    let lanes = new ArrayBuffer(maxLevel * lanelength);
    /**
     * @protected
     * @type {Array<Uint32Array>}
     */
    this.nexts = Array.from({ length: maxLevel }, (_, level) => {
      return new Uint32Array(lanes, level * lanelength, capacity);
    });

    /**
     * @protected
     * @type {Array<Uint32Array>}
     */
    this.prevs = [new Uint32Array(capacity)];
  }

  get size() {
    return this.sizes[0];
  }

  get head() {
    return this.heads[0];
  }

  get tail() {
    return this.tails[0];
  }

  get next() {
    return this.nexts[0];
  }

  get prev() {
    return this.prevs[0];
  }

  /**
   * Whenever a new value added to a collection, insert its index to the skiplist.
   *
   * ```js
   * let slist = new FixedSkipList(1000, 1 / 4, ascending);
   * let values = [];
   *
   * let index = values.push(newValue) - 1;
   * slist.insert(index);
   * ```
   *
   * @param {number} index
   */
  insert(index) {
    let compare = this.compare;
    let insertLevel = this.randomLevel();

    this.currentLevel = Math.max(insertLevel, this.currentLevel);

    let size, head, tail, next, prev, last, curr;
    let insert = false;
    let point = null;
    for (let level = this.currentLevel; level >= 0; level--) {
      insert = level <= insertLevel;
      size = this.sizes[level];
      head = this.heads[level];
      tail = this.tails[level];
      next = this.nexts[level];
      prev = this.prevs[level];

      if (insert) this.sizes[level]++;

      if (size >= 1) {
        if (compare(index, head) < 0) {
          point = null;
          if (insert) {
            this.heads[level] = index;
            next[index] = head;
            if (level === 0) {
              prev[head] = index;
            }
          }
        } else if (compare(index, tail) >= 0) {
          point = tail;
          if (insert) {
            this.tails[level] = index;
            next[tail] = index;
            if (level === 0) {
              prev[index] = tail;
            }
          }
        } else {
          curr = point;
          last = null;
          if (curr == null) {
            last = head;
            curr = next[last];
          }

          for (let i = 0; i < size; i++) {
            if (compare(index, curr) < 0) {
              point = last;
              if (insert) {
                // if we started with last being null, the assumption is we always skip first iteration
                next[last] = index;
                next[index] = curr;
                if (level === 0) {
                  prev[index] = last;
                  prev[curr] = index;
                }
              }
              break;
            }
            last = curr;
            curr = next[curr];
          }
        }
      } else {
        point = null;
        if (insert) {
          this.heads[level] = index;
          this.tails[level] = index;
        }
      }
    }
  }

  /**
   * Remove previously inserted index from all layers.
   *
   * @param {number} index
   */
  remove(index) {
    let size, head, tail, next, prev;
    let point = null;
    for (let level = this.currentLevel; level >= 0; level--) {
      size = this.sizes[level];
      head = this.heads[level];
      tail = this.tails[level];
      next = this.nexts[level];
      prev = this.prevs[level];
      for (let i = 0, curr = point ?? head, last = null; i < size; i++) {
        if (curr === index) {
          point = last;
          this.sizes[level]--;
          if (index === head) {
            this.heads[level] = next[index];
          }
          if (last != null) {
            if (level === 0) {
              prev[next[index]] = last;
            }
            next[last] = next[index];
          }
          if (index === tail) {
            this.tails[level] = last ?? head;
          }
          if (size === 1) this.currentLevel--;
          break;
        }
        last = curr;
        if (curr === tail) break;
        curr = next[curr];
      }
    }
  }

  /**
   * Utilizing layered structure of the skip list, find insertion point for an arbitrary predicate function.
   *
   * @param {(index: number) => boolean} predicate
   */
  bisect(predicate) {
    let size, head, tail, next;
    /** @type {number | null} */
    let point = null;
    for (let level = this.currentLevel; level >= 0; level--) {
      size = this.sizes[level];
      head = this.heads[level];
      tail = this.tails[level];
      next = this.nexts[level];
      let curr = point ?? head;
      let last = null;
      for (let i = 0; i < size; i++) {
        if (predicate(curr)) {
          point = last;
          break;
        }
        last = curr;
        if (curr === tail) break;
        curr = next[curr];
      }
      if (curr === head && level === 0) return head;
    }
    return point;
  }

  /**
   * Find first exact point that satisfies match function.
   *
   * @param {(index: number) => -1 | 0 | 1} match
   */
  search(match) {
    /** @type {number | null} */
    let found = null;
    for (let level = this.currentLevel, head, tail, next, size, curr, last; level >= 0; level--) {
      size = this.sizes[level];
      head = this.heads[level];
      tail = this.tails[level];
      next = this.nexts[level];
      curr = last ?? head;
      for (let i = 0, cmp; i < size && last !== tail; i++) {
        cmp = match(curr);
        if (cmp === 0) found = curr;
        if (cmp >= 0) break;
        last = curr;
        curr = next[curr];
      }
    }
    return found;
  }

  /**
   * @param {number} [start]
   * @param {number} [limit]
   */
  *forwards(start, limit) {
    yield* iterate(this.next, start ?? this.head, this.tail, limit ?? this.size);
  }

  /**
   * @param {number} [start]
   * @param {number} [limit]
   */
  *backwards(start, limit) {
    yield* iterate(this.prev, start ?? this.tail, this.head, limit ?? this.size);
  }

  *[Symbol.iterator]() {
    yield* iterate(this.next, this.head, this.tail, this.size);
  }
}

/**
 * @param {Uint32Array} pointers
 * @param {number} start
 * @param {number} finish
 * @param {number} limit
 */
function* iterate(pointers, start, finish, limit) {
  for (let i = 0, curr = start, last; i < limit && last !== finish; i++, curr = pointers[curr]) {
    yield (last = curr);
  }
}

/**
 * @param {number} count
 * @param {number} ratio
 */
function randomLevelGenerator(count, ratio) {
  let table = new Float64Array(count);
  for (let i = 0; i < count; i++) table[i] = ratio ** (i + 1);
  return function randomLevel() {
    let x = Math.random();
    let lo = 0;
    let hi = count;
    while (lo < hi) {
      let mid = (lo + hi) >>> 1;
      if (x <= table[mid]) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
}
