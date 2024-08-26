import color from "picocolors";
import { test } from "node:test";
import { deepEqual, equal } from "node:assert/strict";

class SkipList {
  constructor(capacity, ratio, compare) {
    this.capacity = capacity;
    this.ratio = ratio;
    this.compare = compare;

    this.values = [];

    this.maxLevel = Math.round(
      Math.log(this.capacity) / Math.log(1 / this.ratio),
    );
    this.currentLevel = 0;

    let metamulti = this.maxLevel * Uint32Array.BYTES_PER_ELEMENT;
    let stats = new ArrayBuffer(3 * metamulti);
    this.heads = new Uint32Array(stats, 0 * metamulti, this.maxLevel);
    this.tails = new Uint32Array(stats, 1 * metamulti, this.maxLevel);
    this.sizes = new Uint32Array(stats, 2 * metamulti, this.maxLevel);

    let lanemulti = this.capacity * Uint32Array.BYTES_PER_ELEMENT;
    let lanes = new ArrayBuffer((this.maxLevel + 1) * lanemulti);
    this.nexts = Array.from({ length: this.maxLevel }, (_, level) => {
      return new Uint32Array(lanes, level * lanemulti, this.capacity);
    });
  }

  insert(value) {
    let index = this.values.push(value) - 1;
    let compare = this.compare;

    let insertLevel = 0;
    while (Math.random() < this.ratio && insertLevel < this.maxLevel)
      insertLevel++;

    this.currentLevel = Math.max(insertLevel, this.currentLevel);

    let size, head, tail, next, prev, curr;
    let insert, start;
    for (let level = this.currentLevel; level >= 0; level--) {
      insert = level <= insertLevel;
      size = this.sizes[level];
      head = this.heads[level];
      tail = this.tails[level];
      next = this.nexts[level];

      if (insert) this.sizes[level]++;

      if (size >= 1) {
        if (compare(value, this.values[head]) < 0) {
          start = null;
          if (insert) {
            this.heads[level] = index;
            next[index] = head;
          }
        } else if (compare(value, this.values[tail]) >= 0) {
          start = tail;
          if (insert) {
            this.tails[level] = index;
            next[start] = index;
          }
        } else {
          curr = start;
          prev = null;
          if (curr == null) {
            prev = head;
            curr = next[prev];
          }

          for (let i = 0; i < size; i++) {
            if (compare(value, this.values[curr]) < 0) {
              start = prev;
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
        start = null;
        if (insert) {
          this.heads[level] = index;
          this.tails[level] = index;
        }
      }
    }
  }

  remove(index) {}

  range(lo, hi) {
    for (let level = this.currentLevel; level >= 0; level--) {}
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
  let list = new SkipList(count, 1 / 8, ascending);

  for (let i = 0; i < count; i++) {
    let value = (Math.random() * 10) | 0;
    list.insert(value);
  }
});

function ascending(a, b) {
  return a == b ? 0 : a < b ? -1 : a > b ? 1 : 0;
}
