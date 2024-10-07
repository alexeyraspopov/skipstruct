export class FixedSkipList {
  /**
   * @param {number} capacity
   * @param {number} ratio
   * @param {(a: number, b: number) => -1 | 0 | 1} compare
   */
  constructor(capacity, ratio, compare) {
    this.capacity = capacity;
    this.ratio = ratio;
    this.compare = compare;

    this.currentLevel = 0;

    let maxLevel = Math.floor(Math.log(capacity) / Math.log(1 / ratio)) + 1;
    let metalength = maxLevel * Uint32Array.BYTES_PER_ELEMENT;
    let metas = new ArrayBuffer(3 * metalength);
    this.heads = new Uint32Array(metas, 0 * metalength, maxLevel);
    this.tails = new Uint32Array(metas, 1 * metalength, maxLevel);
    this.sizes = new Uint32Array(metas, 2 * metalength, maxLevel);

    let mli = maxLevel - 1;
    let table = new Float64Array(mli);
    for (let i = 0; i < mli; i++) table[i] = ratio ** (i + 1);
    this.randomLevel = (rand) => {
      let lo = 0;
      let hi = mli;
      while (lo < hi) {
        let mid = (lo + hi) >>> 1;
        if (rand <= table[mid]) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };

    let lanelength = capacity * Uint32Array.BYTES_PER_ELEMENT;
    let lanes = new ArrayBuffer(maxLevel * lanelength);
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
   * @param {number} index
   */
  insert(index) {
    let compare = this.compare;
    let insertLevel = this.randomLevel(Math.random());

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
   * @param {(index: number) => boolean} predicate
   */
  bisect(predicate) {
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

  *[Symbol.iterator]() {
    let size = this.sizes[0];
    let head = this.heads[0];
    let next = this.nexts[0];
    for (let i = 0, p = head; i < size; i++, p = next[p]) {
      yield p;
    }
  }
}
