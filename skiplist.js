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
    this.capacity = Math.max(0, Math.min(capacity, 2 ** 32 - 1));
    /** @type {number} */
    this.ratio = ratio;

    this.getValueOf = valueOf;
    this.compare = compare;

    /** @type {number} */
    this.size = 0;
    this.head = 0;
    this.tail = 0;

    this.next = new Uint32Array(
      new ArrayBuffer(
        Math.min(capacity, 1024) * Uint32Array.BYTES_PER_ELEMENT,
        { maxByteLength: capacity * Uint32Array.BYTES_PER_ELEMENT },
      ),
    );
    this.prev = new Uint32Array(
      new ArrayBuffer(
        Math.min(capacity, 1024) * Uint32Array.BYTES_PER_ELEMENT,
        { maxByteLength: capacity * Uint32Array.BYTES_PER_ELEMENT },
      ),
    );

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
        point = this.express.insert(index);
      } else if (this.express.size > 0) {
        point = this.express.findRight(index);
      }
    }

    let size = this.size++;

    if (
      this.size <= this.capacity &&
      this.size * Uint32Array.BYTES_PER_ELEMENT > this.next.buffer.byteLength
    ) {
      this.next.buffer.resize(
        Math.min(this.capacity, this.size + 1024) *
          Uint32Array.BYTES_PER_ELEMENT,
      );
      this.prev.buffer.resize(
        Math.min(this.capacity, this.size + 1024) *
          Uint32Array.BYTES_PER_ELEMENT,
      );
    }

    if (size > 1) {
      let value = this.getValueOf(index);

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

      for (
        let i = 0, p = point ?? this.tail;
        i < this.size;
        i++, p = this.prev[p]
      ) {
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
      if (
        this.compare(this.getValueOf(index), this.getValueOf(this.head)) < 0
      ) {
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
  findRight(index) {
    let value = this.getValueOf(index);

    if (this.compare(value, this.getValueOf(this.head)) < 0) {
      return this.head;
    }

    if (this.compare(value, this.getValueOf(this.tail)) >= 0) {
      return null;
    }

    let point = this.express != null ? this.express.findRight(index) : null;

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
  findLeft(index) {
    let value = this.getValueOf(index);

    if (this.compare(value, this.getValueOf(this.head)) <= 0) {
      return this.head;
    }

    if (this.compare(value, this.getValueOf(this.tail)) > 0) {
      return null;
    }

    let point = this.express != null ? this.express.findLeft(index) : null;

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

test("resize dynamically", () => {
  let data = [];
  let list = new SkipList(1024 * 3, (p) => data[p], ascending, 0);

  equal(list.next.buffer.byteLength, 1024 * Uint32Array.BYTES_PER_ELEMENT);
  equal(list.prev.buffer.byteLength, 1024 * Uint32Array.BYTES_PER_ELEMENT);

  for (let index = 0; index < 1024; index++) {
    list.insert(data.push(String(index)) - 1);
  }

  equal(list.size, 1024);

  list.insert(data.push("A") - 1);
  equal(list.size, 1025);
  equal(list.next.buffer.byteLength, 2049 * Uint32Array.BYTES_PER_ELEMENT);
  equal(list.prev.buffer.byteLength, 2049 * Uint32Array.BYTES_PER_ELEMENT);
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

/* node:coverage disable */
let DEBUG = process.env.DEBUG != null;

function display(list) {
  if (!DEBUG) return;

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
        ? color.green(list.getValueOf(c))
        : c == list.tail
          ? color.red(list.getValueOf(c))
          : list.getValueOf(c),
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
        ? color.green(list.getValueOf(c))
        : c == list.tail
          ? color.red(list.getValueOf(c))
          : list.getValueOf(c),
    );
  }
  isn.pop();
  isp.pop();

  let firstLine = `${Array.from(list.next, (v, i) => {
    return v == MASK
      ? color.blue(0)
      : isn.includes(i)
        ? v == list.tail
          ? color.red(v)
          : color.yellow(v)
        : color.gray(v);
  }).join(" ")}`;
  let secondLine = `${Array.from(list.prev, (v, i) => {
    return v == MASK
      ? color.blue(0)
      : isp.includes(i)
        ? v == list.head
          ? color.green(v)
          : color.yellow(v)
        : color.gray(v);
  }).join(" ")}`;
  console.log(firstLine);
  console.log(secondLine);

  console.log(vsn.join(" "));
  console.log(vsp.join(" "));
  console.log(" ");
}
/* node:coverage enable */
