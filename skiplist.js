import color from "picocolors";
import { test } from "node:test";
import { deepEqual, equal, notEqual } from "node:assert/strict";

/** @template Value */
export class SkipList {
  /**
   * @param {number} capacity
   * @param {(point: number) => Value} valueOf
   * @param {(a: Value, b: Value) => -1 | 0 | 1} compare
   * @param {number} ratio
   */
  constructor(capacity, valueOf, compare, ratio) {
    /** @type {number} */
    this.capacity = Math.max(0, Math.min(capacity, 2 ** 25));
    /** @type {number} */
    this.ratio = ratio;

    this.getValueOf = valueOf;
    this.compare = compare;

    /** @type {number} */
    this.size = 0;
    this.head = 0;
    this.tail = 0;

    this.next = new Uint32Array(capacity);
    this.prev = new Uint32Array(capacity);

    /** @type {SkipList<Value> | null} */
    this.express = null;
  }

  /**
   * @param {number} index
   * @returns {number | null}
   */
  insert(index) {
    if (this.express == null && this.size >= 3 / this.ratio) {
      this.express = new SkipList(
        this.capacity,
        this.getValueOf,
        this.compare,
        this.ratio,
      );
    }

    let point = null;
    if (this.express != null) {
      if (Math.random() < this.ratio) {
        point = this.express.insert(index, value);
      } else if (this.express.size > 0) {
        point = this.express.findRight(index, value);
      }
    }

    let size = this.size++;

    if (size > 1) {
      if (this.compare(value, this.getValueOf(this.head)) < 0) {
        this.next[index] = this.head;
        this.prev[this.head] = index;
        this.head = index;
        return this.next[index];
      }

      if (this.compare(value, this.getValueOf(this.tail)) >= 0) {
        this.next[this.tail] = index;
        this.prev[index] = this.tail;
        this.tail = index;
        return null;
      }

      for (let i = 0, p = point ?? this.tail; i < size; i++, p = this.prev[p]) {
        // if p is tail, we'll skip this first iteration since it was covered by condition above
        if (this.compare(value, this.getValueOf(p)) >= 0) {
          point = this.next[p];
          this.next[index] = this.next[p];
          this.prev[index] = p;
          this.prev[this.next[p]] = index;
          this.next[p] = index;
          break;
        }
      }

      return point;
    }

    if (size == 1) {
      let point;
      if (this.compare(value, this.getValueOf(this.head)) < 0) {
        this.head = index;
        point = this.tail;
      } else {
        this.tail = index;
        point = null;
      }

      this.next[this.head] = this.tail;
      this.prev[this.tail] = this.head;
      return point;
    }

    this.head = index;
    this.tail = index;
    return null;
  }

  /** @param {number} index */
  remove(index) {
    if (this.express != null) {
      this.express.remove(index);
    }

    let size = this.size--;
    if (size > 1) {
      if (index == this.head) {
        this.head = this.next[this.head];
      } else if (index == this.tail) {
        this.tail = this.prev[this.tail];
      } else {
        this.next[this.prev[index]] = this.next[index];
        this.prev[this.next[index]] = this.prev[index];
      }
    } else if (size == 1) {
      // nothing to do if i stick to iterating via size
    }
  }

  /** @param {number} index */
  findRight(index, value = this.getValueOf(index)) {
    if (this.compare(value, this.getValueOf(this.head)) < 0) {
      return this.head;
    }

    if (this.compare(value, this.getValueOf(this.tail)) >= 0) {
      return null;
    }

    let point =
      this.express != null && this.express.size > 0
        ? this.express.findRight(index, value)
        : null;

    for (
      let i = 0, p = point ?? this.tail;
      i < this.size;
      i++, p = this.prev[p]
    ) {
      // if p is tail, we'll skip this first iteration since it was covered by condition above
      if (this.compare(value, this.getValueOf(p)) >= 0) {
        point = this.next[p];
        break;
      }
    }

    return point;
  }

  /** @param {number} index */
  findLeft(index, value = this.getValueOf(index)) {
    if (this.compare(value, this.getValueOf(this.head)) <= 0) {
      return this.head;
    }

    if (this.compare(value, this.getValueOf(this.tail)) > 0) {
      return null;
    }

    let point =
      this.express != null && this.express.size > 0
        ? this.express.findLeft(index, value)
        : null;

    for (
      let i = 0, p = point ?? this.head;
      i < this.size;
      i++, p = this.next[p]
    ) {
      if (this.compare(value, this.getValueOf(p)) <= 0) {
        point = p;
        break;
      }
    }

    return point;
  }

  *[Symbol.iterator]() {
    for (let i = 0, p = this.head; i < this.size; i++, p = this.next[p]) {
      yield this.getValueOf(p);
    }
  }
}

test("a lot of records", async () => {
  let count = 1000000;
  let data = [];
  let access = (p) => data[p];
  let list = new SkipList(count, access, ascending, 1 / 4);

  // await new Promise((resolve) => setTimeout(resolve, 10_000));
  // console.log("start");

  console.time("insert");
  for (let i = 0; i < count; i++) {
    let value = (Math.random() * 10) | 0;
    let index = data.push(value) - 1;
    list.insert(index);
  }
  console.timeEnd("insert");

  // console.log(Array.from(hist.entries(), ([s, v]) => [s.size, v]));

  // console.log("stop");
  // await new Promise((resolve) => setTimeout(resolve, 60_000 * 10));

  // console.log(data.map((v) => String(v).padStart(2, " ")).join(" "));
  // display(list);
  // display(list.express);
  // list.express.express && display(list.express.express);
});

test("empty to one", () => {
  let list = new SkipList(10, (v) => v, ascending, 0);
  equal(list.size, 0);
  list.insert(4);
  equal(list.head, list.tail);
  equal(list.size, 1);
  deepEqual(list.next, new Uint32Array(10));
  deepEqual(list.prev, new Uint32Array(10));
  display(list);
});

test("insert left and insert right", () => {
  let point;
  let listA = new SkipList(10, (v) => v, ascending, 0);
  point = listA.insert(4);
  equal(point, null);

  let listB = new SkipList(10, (v) => v, ascending, 0);
  listB.insert(4);

  point = listA.insert(3);
  equal(point, 4);
  point = listB.insert(5);
  equal(point, null);

  display(listA);
  display(listB);

  point = listA.insert(2);
  equal(point, 3);
  point = listB.insert(6);
  equal(point, null);

  display(listA);
  display(listB);
});

test("first three inserts", () => {
  let point;
  let list = new SkipList(10, (v) => v, ascending, 0);

  list.insert(5);
  point = list.insert(4);
  equal(list.head, 4);
  equal(list.tail, 5);
  equal(point, 5);
  deepEqual(list.next, new Uint32Array([0, 0, 0, 0, 5, 0, 0, 0, 0, 0]));
  deepEqual(list.prev, new Uint32Array([0, 0, 0, 0, 0, 4, 0, 0, 0, 0]));

  point = list.insert(6);
  equal(list.head, 4);
  equal(list.tail, 6);
  equal(point, null);
  deepEqual(list.next, new Uint32Array([0, 0, 0, 0, 5, 6, 0, 0, 0, 0]));
  deepEqual(list.prev, new Uint32Array([0, 0, 0, 0, 0, 4, 5, 0, 0, 0]));
});

test("insert in order", () => {
  let point;
  let list = new SkipList(10, (v) => v, ascending, 0);

  point = list.insert(4);
  equal(point, null);

  point = list.insert(8);
  equal(point, null);
  display(list);

  point = list.insert(7);
  equal(point, 8);
  display(list);

  point = list.insert(5);
  equal(point, 7);
  display(list);
});

test("remove from list", () => {
  let list = new SkipList(10, (v) => v, ascending, 0);
  list.insert(4);
  list.insert(8);
  list.insert(7);
  list.insert(5);
  equal(list.size, 4);
  display(list);
  deepEqual(list.next, new Uint32Array([0, 0, 0, 0, 5, 7, 0, 8, 0, 0]));
  deepEqual(list.prev, new Uint32Array([0, 0, 0, 0, 0, 4, 0, 5, 7, 0]));
  list.remove(5);
  equal(list.size, 3);
  display(list);
  deepEqual(list.next, new Uint32Array([0, 0, 0, 0, 7, 7 /*0*/, 0, 8, 0, 0]));
  deepEqual(list.prev, new Uint32Array([0, 0, 0, 0, 0, 4 /*0*/, 0, 4, 7, 0]));
  list.remove(4);
  equal(list.size, 2);
  display(list);
  deepEqual(list.head, 7);
  deepEqual(list.tail, 8);
  deepEqual(
    list.next,
    new Uint32Array([0, 0, 0, 0, 7 /*0*/, 7 /*0*/, 0, 8, 0, 0]),
  );
  deepEqual(
    list.prev,
    new Uint32Array([0, 0, 0, 0, 0, 4 /*0*/, 0, 4 /*0*/, 7, 0]),
  );
  list.remove(8);
  equal(list.size, 1);
  display(list);
  deepEqual(list.head, 7);
  deepEqual(list.tail, 7);
  deepEqual(
    list.next,
    new Uint32Array([0, 0, 0, 0, 7 /*0*/, 7 /*0*/, 0, 8 /*0*/, 0, 0]),
  );
  deepEqual(
    list.prev,
    new Uint32Array([0, 0, 0, 0, 0, 4 /*0*/, 0, 4 /*0*/, 7 /*0*/, 0]),
  );
  list.remove(7);
  equal(list.size, 0);
});

test("express lane init", () => {
  let list = new SkipList(10, (v) => v, ascending, 1);
  equal(list.express, null);
  list.insert(5);
  equal(list.express, null);
  list.insert(4);
  equal(list.express, null);
  list.insert(6);
  equal(list.express, null);
  list.insert(7);
  notEqual(list.express, null);
  equal(Object.getPrototypeOf(list.express), SkipList.prototype);
  equal(list.express.size, 1);
  equal(list.express.head, 7);
  equal(list.express.tail, 7);
});

test("find if not insert", () => {
  let data = [];
  let list = new SkipList(10, (p) => data[p], ascending, 1);
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
  equal(list.express.size, 1);
  point = data.push("C");
  list.insert(point - 1);
  equal(list.size, 5);
  equal(list.express.size, 2);
  deepEqual(Array.from(list), ["A", "C", "D", "E", "G"]);
  deepEqual(Array.from(list.express), ["A", "C"]);
  list.ratio = list.express.ratio = 0;
  point = data.push("B");
  insert = list.insert(point - 1);
  equal(data[insert], "C");
  deepEqual(Array.from(list), ["A", "B", "C", "D", "E", "G"]);
  deepEqual(Array.from(list.express), ["A", "C"]);

  point = data.push("9");
  insert = list.insert(point - 1);
  equal(data[insert], "A");
  deepEqual(Array.from(list), ["9", "A", "B", "C", "D", "E", "G"]);
  deepEqual(Array.from(list.express), ["A", "C"]);

  point = data.push("H");
  insert = list.insert(point - 1);
  equal(insert, null);
  deepEqual(Array.from(list), ["9", "A", "B", "C", "D", "E", "G", "H"]);
  deepEqual(Array.from(list.express), ["A", "C"]);

  list.remove(data.indexOf("C"));
  deepEqual(Array.from(list), ["9", "A", "B", "D", "E", "G", "H"]);
  deepEqual(Array.from(list.express), ["A"]);
});

test("find insertion points", () => {
  let data = ["A", "B", "B", "B", "D", "F"];
  let list = new SkipList(10, (p) => data[p], ascending, 0);
  for (let i = 0; i < data.length; i++) list.insert(i);

  /*         6    7    8    9   10 */
  data.push("9", "B", "E", "G", "A");

  equal(list.findRight(6), 0);
  equal(list.findRight(7), 4);
  equal(list.findRight(8), 5);
  equal(list.findRight(9), null);

  equal(list.findLeft(6), 0);
  equal(list.findLeft(7), 1);
  equal(list.findLeft(8), 5);
  equal(list.findLeft(9), null);
  equal(list.findLeft(10), 0);
});

function ascending(a, b) {
  return a == b ? 0 : a < b ? -1 : a > b ? 1 : 0;
}

/* node:coverage disable */
let DEBUG = process.env.DEBUG != null;

function display(list) {
  if (!DEBUG) return;

  let pad = list.capacity > 10 ? 2 : 1;

  let vsn = [];
  let isn = [];

  let vsp = [];
  let isp = [];

  for (
    let index = 0, c = list.head;
    index < list.size;
    index++, c = list.next[c]
  ) {
    isn.push(c);
    vsn.push(
      c == list.head
        ? color.green(String(list.getValueOf(c)).padStart(pad, " "))
        : c == list.tail
          ? color.red(String(list.getValueOf(c)).padStart(pad, " "))
          : String(list.getValueOf(c)).padStart(pad, " "),
    );
  }

  for (
    let index = 0, c = list.tail;
    index < list.size;
    index++, c = list.prev[c]
  ) {
    isp.push(c);
    vsp.push(
      c == list.head
        ? color.green(String(list.getValueOf(c)).padStart(pad, " "))
        : c == list.tail
          ? color.red(String(list.getValueOf(c)).padStart(pad, " "))
          : String(list.getValueOf(c)).padStart(pad, " "),
    );
  }
  isn.pop();
  isp.pop();

  let firstLine = `${Array.from(list.next, (v, i) => {
    return v == MASK
      ? color.blue("0".padStart(pad, " "))
      : isn.includes(i)
        ? v == list.tail
          ? color.red(String(v).padStart(pad, " "))
          : color.yellow(String(v).padStart(pad, " "))
        : color.gray(String(v).padStart(pad, " "));
  }).join(" ")}`;
  let secondLine = `${Array.from(list.prev, (v, i) => {
    return v == MASK
      ? color.blue("0".padStart(pad, " "))
      : isp.includes(i)
        ? v == list.head
          ? color.green(String(v).padStart(pad, " "))
          : color.yellow(String(v).padStart(pad, " "))
        : color.gray(String(v).padStart(pad, " "));
  }).join(" ")}`;
  console.log(firstLine);
  console.log(secondLine);

  console.log(vsn.join(" "));
  console.log(vsp.join(" "));
  console.log(" ");
}
/* node:coverage enable */
