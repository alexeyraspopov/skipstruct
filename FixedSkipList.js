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
    this.capacity = capacity;
    this.ratio = ratio;
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

    let size, head, tail, next, prev, curr;
    let insert = false;
    let point = null;
    for (let level = this.currentLevel; level >= 0; level--) {
      insert = level <= insertLevel;
      size = this.sizes[level];
      head = this.heads[level];
      tail = this.tails[level];
      next = this.nexts[level];

      if (insert) this.sizes[level]++;

      if (size >= 1) {
        if (compare(index, head) < 0) {
          point = null;
          if (insert) {
            this.heads[level] = index;
            next[index] = head;
          }
        } else if (compare(index, tail) >= 0) {
          point = tail;
          if (insert) {
            this.tails[level] = index;
            next[tail] = index;
          }
        } else {
          curr = point;
          prev = null;
          if (curr == null) {
            prev = head;
            curr = next[prev];
          }

          for (let i = 0; i < size; i++) {
            if (compare(index, curr) < 0) {
              point = prev;
              if (insert) {
                // if we started with prev being null, the assumption is we always skip first iteration
                next[prev] = index;
                next[index] = curr;
              }
              break;
            }
            prev = curr;
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
    let size, head, tail, next;
    let point = null;
    for (let level = this.currentLevel; level >= 0; level--) {
      size = this.sizes[level];
      head = this.heads[level];
      tail = this.tails[level];
      next = this.nexts[level];
      let curr = point ?? head;
      let prev = null;
      for (let i = 0; i < size; i++) {
        if (curr === index) {
          point = prev;
          this.sizes[level]--;
          if (index === head) {
            this.heads[level] = next[index];
          }
          if (prev != null) {
            next[prev] = next[index];
          }
          if (index === tail) {
            this.tails[level] = prev ?? head;
          }
          if (size === 1) this.currentLevel--;
          break;
        }
        prev = curr;
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
      let prev = null;
      for (let i = 0; i < size; i++) {
        if (predicate(curr)) {
          point = prev;
          break;
        }
        prev = curr;
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
    for (let level = this.currentLevel, head, tail, next, size, curr, edge; level >= 0; level--) {
      size = this.sizes[level];
      head = this.heads[level];
      tail = this.tails[level];
      next = this.nexts[level];
      curr = edge ?? head;
      for (let i = 0, cmp; i < size && edge !== tail; i++) {
        cmp = match(curr);
        if (cmp === 0) found = curr;
        if (cmp >= 0) break;
        edge = curr;
        curr = next[curr];
      }
    }
    return found;
  }

  *[Symbol.iterator]() {
    let size = this.sizes[0];
    let head = this.heads[0];
    let next = this.nexts[0];
    for (let i = 0, p = head; i < size; i++, p = next[p]) {
      yield p;
    }
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
