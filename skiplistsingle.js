import color from "picocolors";
import { test } from "node:test";
import { deepEqual, equal, notEqual } from "node:assert/strict";

class SkipList {
  constructor(capacity, ratio, compare) {
    this.capacity = capacity;
    this.ratio = ratio;
    this.compare = compare;

    this.size = 0;
    this.head = 0;
    this.tail = 0;
    this.forward = new Uint32Array(this.capacity);
    this.express = null;
  }

  approx(index) {
    if (this.compare(index, this.head) < 0) {
      return null;
    }

    if (this.compare(index, this.tail) >= 0) {
      return this.tail;
    }

    let point =
      this.express != null && this.express.size > 0
        ? this.express.approx(index)
        : null;

    let cursor, prev;
    if (point != null) {
      cursor = point;
      prev = null;
    } else {
      cursor = this.forward[this.head];
      prev = this.head;
    }
    for (let i = 0; i < this.size; i++) {
      if (this.compare(index, cursor) < 0) {
        return prev;
      }
      prev = cursor;
      cursor = this.forward[cursor];
    }
    return null;
  }

  insert(index) {
    let point = null;
    if (this.express != null) {
      if (Math.random() < this.ratio) {
        point = this.express.insert(index);
      } else if (this.express.size > 0) {
        point = this.express.approx(index);
      }
    } else if (this.size >= 1 / this.ratio) {
      this.express = new SkipList(this.capacity, this.ratio, this.compare);
    }

    let size = this.size++;

    if (size > 1) {
      if (this.compare(index, this.head) < 0) {
        this.forward[index] = this.head;
        this.head = index;
        return null;
      }

      if (this.compare(index, this.tail) >= 0) {
        let point = this.tail;
        this.forward[this.tail] = index;
        this.tail = index;
        return point;
      }

      let cursor, prev;
      if (point != null) {
        cursor = point;
        prev = null;
      } else {
        cursor = this.forward[this.head];
        prev = this.head;
      }
      for (let i = 0; i < size; i++) {
        if (this.compare(index, cursor) < 0) {
          this.forward[prev] = index;
          this.forward[index] = cursor;
          return prev;
        }
        prev = cursor;
        cursor = this.forward[cursor];
      }

      return null;
    }

    if (size == 1) {
      if (this.compare(index, this.head) < 0) {
        this.head = index;
        this.forward[index] = this.tail;
        return null;
      } else {
        this.tail = index;
        this.forward[this.head] = this.tail;
        return this.head;
      }
    }

    this.head = this.tail = index;
    return null;
  }
}

const LARGE_LIST_COUNT = 1_000_000;

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

function ascending(a, b) {
  return a == b ? 0 : a < b ? -1 : a > b ? 1 : 0;
}
