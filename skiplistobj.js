import { test } from "node:test";
import { deepEqual, equal } from "node:assert/strict";

class SkipList {
  constructor(compare, ratio) {
    this.ratio = ratio;
    this.express = null;
    this.head = null;
    this.tail = null;
    this.size = 0;
    this.compare = compare;
  }

  insert(value) {
    if (this.express == null && this.size >= 3 / this.ratio) {
      this.express = new SkipList(this.compare, this.ratio);
    }

    let point = null;
    if (this.express != null) {
      if (Math.random() < this.ratio) {
        point = this.express.insert(value);
      } else if (this.express.size > 0) {
        point = this.express.findRight(value);
      }
    }

    let size = this.size++;

    if (size > 1) {
      if (this.compare(value, this.head.value) < 0) {
        let local = { value, next: this.head, prev: null };
        if (point != null) point.local = local;
        point = this.head;
        this.head = this.head.prev = local;
        return point;
      }

      if (this.compare(value, this.tail.value) >= 0) {
        let local = { value, next: null, prev: this.tail };
        if (point != null) point.local = local;
        this.tail = this.tail.next = local;
        return null;
      }

      for (
        let i = 0, p = point?.local ?? this.tail;
        i < size;
        i++, p = p.prev
      ) {
        if (this.compare(value, p.value) >= 0) {
          let local = { value, next: p.next, prev: p };
          if (point != null) point.local = local;
          point = p.next;
          p.next = point.prev = local;
          break;
        }
      }

      return point;
    }

    if (size == 1) {
      let point;
      if (this.compare(value, this.head.value) < 0) {
        let local = { value, next: this.head, prev: null };
        point = this.tail = this.head;
        this.head = this.tail.prev = local;
      } else {
        let local = { value, next: null, prev: this.head };
        point = null;
        this.tail = this.head.next = local;
      }
      return point;
    }

    this.head = this.tail = { value, next: null, prev: null };
    return null;
  }

  findRight(value) {
    if (this.compare(value, this.head.value) < 0) {
      return this.head;
    }

    if (this.compare(value, this.tail.value) >= 0) {
      return null;
    }

    let point =
      this.express != null && this.express.size > 0
        ? this.express.findRight(value)
        : null;

    // what if i traverse till next _unique_ value
    for (
      let i = 0, p = point?.local ?? this.tail;
      i < this.size;
      i++, p = p.prev
    ) {
      // if p is tail, we'll skip this first iteration since it was covered by condition above
      if (this.compare(value, p.value) >= 0) {
        point = p.next;
        break;
      }
    }

    return point;
  }
}

function ascending(a, b) {
  return a == b ? 0 : a < b ? -1 : a > b ? 1 : 0;
}

test("empty to one", () => {
  let list = new SkipList(ascending, 0);
  equal(list.size, 0);
  list.insert(4);
  equal(list.head, list.tail);
  equal(list.size, 1);
  // console.log(list);
});

test("insert left and insert right", () => {
  let point;
  let listA = new SkipList(ascending, 0);
  point = listA.insert(4);
  equal(point, null);

  let listB = new SkipList(ascending, 0);
  listB.insert(4);

  point = listA.insert(3);
  equal(point.value, 4);
  point = listB.insert(5);
  equal(point, null);

  // console.log(listA);
  // console.log(listB);

  point = listA.insert(2);
  equal(point.value, 3);
  point = listB.insert(6);
  equal(point, null);

  // console.log(listA);
  // console.log(listB);
});

test("first three inserts", () => {
  let point;
  let list = new SkipList(ascending, 0);

  list.insert(5);
  point = list.insert(4);
  equal(list.head.value, 4);
  equal(list.tail.value, 5);
  equal(point.value, 5);
  // deepEqual(list.next, new Uint32Array([0, 0, 0, 0, 5, 0, 0, 0, 0, 0]));
  // deepEqual(list.prev, new Uint32Array([0, 0, 0, 0, 0, 4, 0, 0, 0, 0]));

  point = list.insert(6);
  equal(list.head.value, 4);
  equal(list.tail.value, 6);
  equal(point, null);
  // deepEqual(list.next, new Uint32Array([0, 0, 0, 0, 5, 6, 0, 0, 0, 0]));
  // deepEqual(list.prev, new Uint32Array([0, 0, 0, 0, 0, 4, 5, 0, 0, 0]));
});

test("insert in order", () => {
  let point;
  let list = new SkipList(ascending, 0);

  point = list.insert(4);
  equal(point, null);

  point = list.insert(8);
  equal(point, null);
  // display(list);

  point = list.insert(7);
  equal(point.value, 8);
  // display(list);

  point = list.insert(5);
  equal(point.value, 7);
  // display(list);
});

test("a lot", async () => {
  let count = 1000000;
  let list = new SkipList(ascending, 1 / 4);

  // await sleep(10_000);
  // console.log("start");

  for (let i = 0; i < count; i++) {
    let value = (Math.random() * 10) | 0;
    list.insert(value);
  }

  // console.log(Array.from(hist.entries(), ([s, v]) => [s.size, v]));

  // console.log("stop");
  // await sleep(60_000 * 10);

  // console.log(data.map((v) => String(v).padStart(2, " ")).join(" "));
  // display(list);
  // display(list.express);
  // list.express.express && display(list.express.express);
});
