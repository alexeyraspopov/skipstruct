import { test } from "node:test";
import { equal, deepEqual } from "node:assert/strict";

/** @template Value */
export class CircularBuffer {
	/** @param {number} [capacity] */
	constructor(capacity = 2 ** 25) {
		/** @type {number} */
		this.capacity = capacity;
		/** @type {Array<Value>} */
		this.values = [];
		/** @type {number} */
		this.limit = 0;
		/** @type {number} */
		this.cursor = 0;
	}

	/** @param {number} index */
	at(index) {
		return this.values[index];
		// return this.values.at((index + this.cursor) % this.capacity);
	}

	/** @param {Value} value */
	append(value) {
		if (this.limit < this.capacity) {
			this.values.push(value);
			return this.limit++;
		}
		let index = this.cursor++;
		this.values[index] = value;
		this.cursor %= this.capacity;
		return index;
	}

	*[Symbol.iterator]() {
		for (let offset = 0; offset < this.capacity; offset++) {
			yield this.values[(offset + this.cursor) % this.capacity];
		}
	}
}

test("circular buffer", () => {
	let vec = new CircularBuffer(5);

	equal(vec.append("a"), 0);
	equal(vec.append("b"), 1);
	equal(vec.append("c"), 2);
	equal(vec.append("d"), 3);
	equal(vec.append("e"), 4);
	equal(vec.append("f"), 0);
	equal(vec.append("g"), 1);
	equal(vec.append("h"), 2);
	equal(vec.append("i"), 3);
	equal(vec.append("j"), 4);
	equal(vec.append("k"), 0);
	deepEqual(vec.values, ["k", "g", "h", "i", "j"]);
	deepEqual(Array.from(vec), ["g", "h", "i", "j", "k"]);
});

test("linked rank", async () => {
	class LinkedRank {
		constructor(capacity) {
			this.capacity = capacity;
			this.head = 0;
			this.tail = 0;
			this.size = 0;
			this.next = new Uint32Array(capacity);
			this.prev = new Uint32Array(capacity);
			this.expw = null;
		}
	}

	function order(a, b) {
		return a < b ? -1 : a > b ? 1 : 0;
	}

	let p = 1 / 16;
	let m = 3 / p;

	function insert(rank, index, valueOf) {
		let value = valueOf(index);

		if (rank.size === 0 || order(value, valueOf(rank.head)) <= 0) {
			rank.next[index] = rank.head;
			rank.prev[rank.head] = index;
			rank.head = index;
		} else if (order(value, valueOf(rank.tail)) >= 0) {
			rank.next[rank.tail] = index;
			rank.prev[index] = rank.tail;
			rank.tail = index;
		} else {
			let point = search(rank, index, valueOf);
			rank.next[rank.prev[point]] = index;
			rank.prev[index] = rank.prev[point];
			rank.prev[point] = index;
			rank.next[index] = point;
		}
		rank.size++;

		if (rank.size < m) return;
		if (rank.expw == null) rank.expw = new LinkedRank(rank.capacity);
		if (Math.random() < p) insert(rank.expw, index, valueOf);
	}

	function search(rank, index, valueOf) {
		let point =
			rank.expw != null && rank.expw.size > 0 ? search(rank.expw, index, valueOf) : rank.head;
		let value = valueOf(index);
		while (order(valueOf(point), value) <= 0 && point !== rank.tail) {
			point = rank.next[point];
		}
		return point;
	}

	function remove(rank, index) {
		if (rank.expw != null) remove(rank.expw, index);

		if (rank.prev[index] !== rank.next[index]) {
			rank.size--;
		}

		if (rank.head === index) {
			rank.head = rank.next[index];
		} else if (rank.tail === index) {
			rank.tail = rank.prev[index];
		} else {
			rank.next[rank.prev[index]] = rank.next[index];
			rank.prev[rank.next[index]] = rank.prev[index];
		}
	}

	let data = new CircularBuffer(6);
	let rank = new LinkedRank(6);

	let value, index;
	let valueOf = (index) => data.values[index];

	value = "c";
	index = data.append(value);
	equal(index, 0);
	insert(rank, index, valueOf);
	deepEqual(follow(valueOf, rank.next, rank.head, rank.size), ["c"]);
	deepEqual(follow(valueOf, rank.prev, rank.tail, rank.size), ["c"]);

	value = "a";
	index = data.append(value);
	equal(index, 1);
	insert(rank, index, valueOf);
	deepEqual(follow(valueOf, rank.next, rank.head, rank.size), ["a", "c"]);
	deepEqual(follow(valueOf, rank.prev, rank.tail, rank.size), ["c", "a"]);

	value = "d";
	index = data.append(value);
	equal(index, 2);
	insert(rank, index, valueOf);
	deepEqual(follow(valueOf, rank.next, rank.head, rank.size), ["a", "c", "d"]);
	deepEqual(follow(valueOf, rank.prev, rank.tail, rank.size), ["d", "c", "a"]);

	value = "b";
	index = data.append(value);
	equal(index, 3);
	insert(rank, index, valueOf);
	deepEqual(follow(valueOf, rank.next, rank.head, rank.size), ["a", "b", "c", "d"]);
	deepEqual(follow(valueOf, rank.prev, rank.tail, rank.size), ["d", "c", "b", "a"]);

	value = "f";
	index = data.append(value);
	equal(index, 4);
	insert(rank, index, valueOf);
	deepEqual(follow(valueOf, rank.next, rank.head, rank.size), ["a", "b", "c", "d", "f"]);
	deepEqual(follow(valueOf, rank.prev, rank.tail, rank.size), ["f", "d", "c", "b", "a"]);

	value = "e";
	index = data.append(value);
	equal(index, 5);
	insert(rank, index, valueOf);
	deepEqual(follow(valueOf, rank.next, rank.head, rank.size), ["a", "b", "c", "d", "e", "f"]);
	deepEqual(follow(valueOf, rank.prev, rank.tail, rank.size), ["f", "e", "d", "c", "b", "a"]);

	value = "g";
	index = data.append(value);
	equal(index, 0);
	// evict first
	remove(rank, index);
	insert(rank, index, valueOf);
	deepEqual(follow(valueOf, rank.next, rank.head, rank.size), ["a", "b", "d", "e", "f", "g"]);
	deepEqual(follow(valueOf, rank.prev, rank.tail, rank.size), ["g", "f", "e", "d", "b", "a"]);

	value = "b";
	index = data.append(value);
	equal(index, 1);
	remove(rank, index);
	insert(rank, index, valueOf);
	deepEqual(follow(valueOf, rank.next, rank.head, rank.size), ["b", "b", "d", "e", "f", "g"]);
	deepEqual(follow(valueOf, rank.prev, rank.tail, rank.size), ["g", "f", "e", "d", "b", "b"]);

	value = "f";
	index = data.append(value);
	equal(index, 2);
	remove(rank, index);
	insert(rank, index, valueOf);
	deepEqual(follow(valueOf, rank.next, rank.head, rank.size), ["b", "b", "e", "f", "f", "g"]);
	deepEqual(follow(valueOf, rank.prev, rank.tail, rank.size), ["g", "f", "f", "e", "b", "b"]);

	value = "g";
	index = data.append(value);
	equal(index, 3);
	remove(rank, index);
	insert(rank, index, valueOf);
	deepEqual(follow(valueOf, rank.next, rank.head, rank.size), ["b", "e", "f", "f", "g", "g"]);
	deepEqual(follow(valueOf, rank.prev, rank.tail, rank.size), ["g", "g", "f", "f", "e", "b"]);

	await new Promise((resolve) => setTimeout(resolve, 10_000));
	console.log("start");

	data = new CircularBuffer(1_000_000);
	rank = new LinkedRank(1_000_000);

	for (let i = 0; i < 1000000; i++) {
		let value = (Math.random() * 10) | 0;
		let index = data.append(value);
		insert(rank, index, valueOf);
	}

	console.log("stop");
	await new Promise((resolve) => setTimeout(resolve, 1000_000));
});

function follow(valueOf, pointers, start, size) {
	let result = [];
	let cursor = start;
	for (let i = 0; i < size; i++) {
		result.push(valueOf(cursor));
		cursor = pointers[cursor];
	}
	return result;
}
