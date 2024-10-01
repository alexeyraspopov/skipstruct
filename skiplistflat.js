import { test } from "node:test";
import { deepEqual, equal } from "node:assert/strict";

export class SkipList {
  /**
   * @param {number} capacity
   * @param {number} ratio
   * @param {(a: number, b: number) => -1 | 0 | 1} compare
   */
  constructor(capacity, ratio, compare) {
    this.capacity = capacity;
    this.ratio = ratio;
    this.compare = compare;

    this.maxLevel = Math.floor(Math.log(capacity) / Math.log(1 / ratio)) + 1;
    this.currentLevel = 0;

    let metalength = this.maxLevel * Uint32Array.BYTES_PER_ELEMENT;
    let metas = new ArrayBuffer(3 * metalength);
    this.heads = new Uint32Array(metas, 0 * metalength, this.maxLevel);
    this.tails = new Uint32Array(metas, 1 * metalength, this.maxLevel);
    this.sizes = new Uint32Array(metas, 2 * metalength, this.maxLevel);

    let lanelength = this.capacity * Uint32Array.BYTES_PER_ELEMENT;
    let lanes = new ArrayBuffer(this.maxLevel * lanelength);
    this.nexts = Array.from({ length: this.maxLevel }, (_, level) => {
      return new Uint32Array(lanes, level * lanelength, this.capacity);
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

    let insertLevel = 0;
    while (Math.random() < this.ratio && insertLevel < this.maxLevel)
      insertLevel++;

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

const LARGE_LIST_COUNT = 1000000;

test("baseline rank", () => {
  let count = LARGE_LIST_COUNT;
  let data = [];
  let order = (ia, ib) => ascending(data[ia], data[ib]);
  let rank = new Uint32Array(count);

  for (let i = 0; i < count; i++) {
    let value = (Math.random() * 10) | 0;
    let index = data.push(value) - 1;
    rank[i] = index;
  }
  rank.sort(order);
});

test("a lot of records", () => {
  let count = LARGE_LIST_COUNT;
  let data = [];
  let order = (ia, ib) => ascending(data[ia], data[ib]);
  let list = new SkipList(count, 1 / 8, order);

  for (let i = 0; i < count; i++) {
    let value = (Math.random() * 10) | 0;
    let index = data.push(value) - 1;
    list.insert(index);
  }
});

test("empty to one", () => {
  let list = new SkipList(10, 0, ascending);
  equal(list.size, 0);
  list.insert("4");
  equal(list.heads[0], list.tails[0]);
  equal(list.size, 1);
});

test("insert left and insert right", () => {
  let listA = new SkipList(10, 0, ascending);
  listA.insert(4);
  listA.insert(3);
  listA.insert(2);
  console.log(listA.nexts[0], listA.heads[0], listA.tails[0]);
  let listB = new SkipList(10, 0, ascending);
  listB.insert(4);
  listB.insert(5);
  listB.insert(6);
  console.log(listB.nexts[0], listB.heads[0], listB.tails[0]);
});

test("remove from list", () => {
  let list = new SkipList(10, 1 / 4, ascending);

  list.insert(4);
  list.insert(8);
  list.insert(7);
  list.insert(5);
  equal(list.size, 4);
  deepEqual(Array.from(list), [4, 5, 7, 8]);
  list.remove(5);
  equal(list.size, 3);
  deepEqual(Array.from(list), [4, 7, 8]);
  list.remove(4);
  equal(list.size, 2);
  deepEqual(Array.from(list), [7, 8]);
  list.remove(8);
  equal(list.size, 1);
  deepEqual(Array.from(list), [7]);
  list.remove(7);
  equal(list.size, 0);
  deepEqual(Array.from(list), []);
});

test("find insertion points", () => {
  let data = ["A", "B", "B", "B", "D", "F"];
  let order = (ia, ib) => ascending(data[ia], data[ib]);
  let list = new SkipList(10, 1 / 2, order);
  for (let i = 0; i < data.length; i++) list.insert(i);
  /*         6    7    8    9   10 */
  data.push("9", "B", "E", "G", "A");

  equal(list.size, 6);

  // right
  equal(
    list.bisect((c) => list.compare(6, c) < 0),
    0,
  );
  equal(
    list.bisect((c) => list.compare(7, c) < 0),
    3,
  );
  equal(
    list.bisect((c) => list.compare(8, c) < 0),
    4,
  );
  equal(
    list.bisect((c) => list.compare(9, c) < 0),
    null,
  );

  // left
  equal(
    list.bisect((c) => list.compare(6, c) <= 0),
    0,
  );
  let left;
  left = list.bisect((c) => list.compare(7, c) <= 0);
  equal(left, 0);
  equal(list.nexts[0][left], 1);
  left = list.bisect((c) => list.compare(8, c) <= 0);
  equal(left, 4);
  equal(list.nexts[0][left], 5);
  equal(
    list.bisect((c) => list.compare(9, c) <= 0),
    null,
  );
  equal(
    list.bisect((c) => list.compare(10, c) <= 0),
    0,
  );
});

function ascending(a, b) {
  return a == b ? 0 : a < b ? -1 : a > b ? 1 : 0;
}
