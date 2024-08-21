import color from "picocolors";
import { test } from "node:test";
import { deepEqual, equal } from "node:assert/strict";

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

  find(predicate) {
    if (!predicate(this.tail)) return null;

    let point =
      this.express != null && this.express.size > 0
        ? this.express.find(predicate)
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
      if (predicate(cursor)) {
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

  remove(index) {
    let point =
      this.express != null && this.express.size > 0
        ? this.express.remove(index)
        : null;

    if (this.size > 1) {
      if (this.head == index) {
        this.head = this.forward[this.head];
        this.size--;
        return null;
      }

      let cursor = point ?? this.head;
      for (let i = 0, next; i < this.size; i++) {
        // how do I test this?
        if (cursor == this.tail) break;

        next = this.forward[cursor];
        if (next == index) {
          if (this.tail == next) {
            this.tail = cursor;
          } else {
            this.forward[cursor] = this.forward[next];
          }
          this.size--;
          return cursor;
        }
        cursor = next;
      }

      return null;
    }

    if (this.size == 1) {
      this.size--;
      return null;
    }

    return null;
  }

  *[Symbol.iterator]() {
    for (let i = 0, p = this.head; i < this.size; i++, p = this.forward[p]) {
      yield p;
    }
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

test("empty to one", () => {
  let list = new SkipList(10, 0, ascending);
  equal(list.size, 0);
  list.insert(4);
  equal(list.head, list.tail);
  equal(list.size, 1);
  deepEqual(list.forward, new Uint32Array(10));
  display(list);
});

test("insert left and insert right", () => {
  let point;
  let listA = new SkipList(10, 0, ascending);
  point = listA.insert(4);
  equal(point, null);

  let listB = new SkipList(10, 0, ascending);
  listB.insert(4);

  point = listA.insert(3);
  equal(point, null);
  point = listB.insert(5);
  equal(point, 4);

  display(listA);
  display(listB);

  point = listA.insert(2);
  equal(point, null);
  point = listB.insert(6);
  equal(point, 5);

  display(listA);
  display(listB);
});

test("first three inserts", () => {
  let point;
  let list = new SkipList(10, 0, ascending);

  list.insert(5);
  point = list.insert(4);
  equal(list.head, 4);
  equal(list.tail, 5);
  equal(point, null);
  deepEqual(list.forward, new Uint32Array([0, 0, 0, 0, 5, 0, 0, 0, 0, 0]));

  point = list.insert(6);
  equal(list.head, 4);
  equal(list.tail, 6);
  equal(point, 5);
  deepEqual(list.forward, new Uint32Array([0, 0, 0, 0, 5, 6, 0, 0, 0, 0]));
});

test("insert in order", () => {
  let point;
  let list = new SkipList(10, 0, ascending);

  point = list.insert(4);
  equal(point, null);

  point = list.insert(8);
  equal(point, 4);
  display(list);

  point = list.insert(7);
  equal(point, 4);
  display(list);

  point = list.insert(5);
  equal(point, 4);
  display(list);
});

test("remove from list", () => {
  let list = new SkipList(10, 1, ascending);
  list.insert(4);
  list.insert(8);
  list.insert(7);
  list.insert(5);
  equal(list.size, 4);
  display(list);
  deepEqual(list.forward, new Uint32Array([0, 0, 0, 0, 5, 7, 0, 8, 0, 0]));
  list.remove(5);
  equal(list.size, 3);
  display(list);
  deepEqual(
    list.forward,
    new Uint32Array([0, 0, 0, 0, 7, 7 /*0*/, 0, 8, 0, 0]),
  );
  list.remove(4);
  equal(list.size, 2);
  display(list);
  deepEqual(list.head, 7);
  deepEqual(list.tail, 8);
  deepEqual(
    list.forward,
    new Uint32Array([0, 0, 0, 0, 7 /*0*/, 7 /*0*/, 0, 8, 0, 0]),
  );
  list.remove(8);
  equal(list.size, 1);
  display(list);
  deepEqual(list.head, 7);
  deepEqual(list.tail, 7);
  deepEqual(
    list.forward,
    new Uint32Array([0, 0, 0, 0, 7 /*0*/, 7 /*0*/, 0, 8 /*0*/, 0, 0]),
  );
  list.remove(7);
  equal(list.size, 0);
});

test("express lane init", () => {
  let list = new SkipList(10, 1, ascending);
  equal(list.express, null);
  list.insert(5);
  equal(list.express, null);
  list.insert(4);
  equal(Object.getPrototypeOf(list.express), SkipList.prototype);
  list.insert(6);
  equal(list.express.size, 1);
  equal(list.express.head, 6);
  equal(list.express.tail, 6);
  list.insert(7);
  equal(list.express.size, 2);
  equal(list.express.head, 6);
  equal(list.express.tail, 7);
});

test("find if not insert", () => {
  let data = [];
  let order = (ia, ib) => ascending(data[ia], data[ib]);
  let list = new SkipList(10, 1, order);
  let point, insert;
  point = data.push("D");
  list.insert(point - 1);
  point = data.push("E");
  list.insert(point - 1);
  point = data.push("G");
  list.insert(point - 1);
  point = data.push("A");
  list.insert(point - 1);
  equal(list.size, 4);
  equal(list.express.size, 2);
  point = data.push("C");
  list.insert(point - 1);
  equal(list.size, 5);
  equal(list.express.size, 3);
  deepEqual(
    Array.from(list, (p) => data[p]),
    ["A", "C", "D", "E", "G"],
  );
  deepEqual(
    Array.from(list.express, (p) => data[p]),
    ["A", "C", "G"],
  );
  list.ratio = list.express.ratio = 0;
  point = data.push("B");
  insert = list.insert(point - 1);
  equal(data[insert], "A");
  deepEqual(
    Array.from(list, (p) => data[p]),
    ["A", "B", "C", "D", "E", "G"],
  );
  deepEqual(
    Array.from(list.express, (p) => data[p]),
    ["A", "C", "G"],
  );

  point = data.push("9");
  insert = list.insert(point - 1);
  equal(insert, null);
  deepEqual(
    Array.from(list, (p) => data[p]),
    ["9", "A", "B", "C", "D", "E", "G"],
  );
  deepEqual(
    Array.from(list.express, (p) => data[p]),
    ["A", "C", "G"],
  );

  point = data.push("H");
  insert = list.insert(point - 1);
  equal(data[insert], "G");
  deepEqual(
    Array.from(list, (p) => data[p]),
    ["9", "A", "B", "C", "D", "E", "G", "H"],
  );
  deepEqual(
    Array.from(list.express, (p) => data[p]),
    ["A", "C", "G"],
  );

  list.remove(data.indexOf("C"));
  deepEqual(
    Array.from(list, (p) => data[p]),
    ["9", "A", "B", "D", "E", "G", "H"],
  );
  deepEqual(
    Array.from(list.express, (p) => data[p]),
    ["A", "G"],
  );
});

test("find insertion points", () => {
  let data = ["A", "B", "B", "B", "D", "F"];
  let order = (ia, ib) => ascending(data[ia], data[ib]);
  let list = new SkipList(10, 1, order);
  for (let i = 0; i < data.length; i++) list.insert(i);
  /*         6    7    8    9   10 */
  data.push("9", "B", "E", "G", "A");

  equal(list.size, 6);
  equal(list.express.size, 4);
  equal(list.express.express.size, 2);
  equal(list.express.express.express.size, 0);

  // right
  equal(
    list.find((c) => list.compare(6, c) < 0),
    0,
  );
  equal(
    list.find((c) => list.compare(7, c) < 0),
    3,
  );
  equal(
    list.find((c) => list.compare(8, c) < 0),
    4,
  );
  equal(
    list.find((c) => list.compare(9, c) < 0),
    null,
  );

  // left
  equal(
    list.find((c) => list.compare(6, c) <= 0),
    0,
  );
  let left;
  left = list.find((c) => list.compare(7, c) <= 0);
  equal(left, 0);
  equal(list.forward[left], 1);
  left = list.find((c) => list.compare(8, c) <= 0);
  equal(left, 4);
  equal(list.forward[left], 5);
  equal(
    list.find((c) => list.compare(9, c) <= 0),
    null,
  );
  equal(
    list.find((c) => list.compare(10, c) <= 0),
    0,
  );
});

function ascending(a, b) {
  return a == b ? 0 : a < b ? -1 : a > b ? 1 : 0;
}

let MASK = 2 ** 32 - 1;

/* node:coverage disable */
function display(list) {
  let pad = list.capacity > 10 ? 2 : 1;

  let vsn = [];
  let isn = [];

  for (
    let index = 0, c = list.head;
    index < list.size;
    index++, c = list.forward[c]
  ) {
    isn.push(c);
    vsn.push(
      c == list.head
        ? color.green(String(c).padStart(pad, " "))
        : c == list.tail
          ? color.red(String(c).padStart(pad, " "))
          : String(c).padStart(pad, " "),
    );
  }

  let firstLine = `${Array.from(list.forward, (v, i) => {
    return v == MASK
      ? color.blue("0".padStart(pad, " "))
      : isn.includes(i)
        ? v == list.tail
          ? color.red(String(v).padStart(pad, " "))
          : color.yellow(String(v).padStart(pad, " "))
        : color.gray(String(v).padStart(pad, " "));
  }).join(" ")}`;

  console.log(firstLine);
  console.log(vsn.join(" "));
  console.log(" ");
}
/* node:coverage enable */
