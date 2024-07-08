import { test } from "node:test";
import { equal, deepEqual } from "node:assert/strict";
import { CircularBuffer } from "./modules/CircularBuffer.js";

test("circular vector", () => {
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

test("dll for order", () => {
	let data = new CircularBuffer(6);
	let head = 0;
	let tail = 0;
	let size = 0;
	let next = new Uint32Array(6); // ideally dynamic arrays
	let prev = new Uint32Array(6); // ideally dynamic arrays

	let index, value;

	function insert(value, valueOf, index) {
		if (value <= valueOf(head)) {
			let point = index;
			next[point] = head;
			prev[head] = point;
			head = point;
		} else if (value >= valueOf(tail)) {
			let point = index;
			next[tail] = point;
			prev[point] = tail;
			tail = point;
		} else {
			let point = bisectRight(next, value, valueOf, head, tail, size);
			next[prev[point]] = index;
			prev[index] = prev[point];
			prev[point] = index;
			next[index] = point;
		}
		size++;
	}

	function bisectRight(list, value, valueOf, head, tail, size) {
		let lo = 0;
		let hi = size;
		let point = head;
		while (lo < hi) {
			let mid = (lo + hi) >>> 1;
			let midp = point;
			for (let i = mid; i > lo; i--, midp = list[midp]) {}
			if (valueOf(midp) <= value) {
				point = list[midp];
				lo = mid + 1;
			} else {
				hi = mid;
			}
		}
		return point;
	}

	function remove(index) {
		if (head === index) {
			head = next[index];
		} else if (tail === index) {
			tail = prev[index];
		} else {
			next[prev[index]] = next[index];
			prev[next[index]] = prev[index];
		}
		size--;
	}

	function valueOf(point) {
		return data.values[point];
	}

	value = "c";
	index = data.append(value);
	equal(index, 0);
	insert(value, valueOf, index);
	deepEqual(follow(valueOf, next, head, size), ["c"]);
	deepEqual(follow(valueOf, prev, tail, size), ["c"]);

	value = "a";
	index = data.append(value);
	equal(index, 1);
	insert(value, valueOf, index);
	deepEqual(follow(valueOf, next, head, size), ["a", "c"]);
	deepEqual(follow(valueOf, prev, tail, size), ["c", "a"]);

	value = "d";
	index = data.append(value);
	equal(index, 2);
	insert(value, valueOf, index);
	deepEqual(follow(valueOf, next, head, size), ["a", "c", "d"]);
	deepEqual(follow(valueOf, prev, tail, size), ["d", "c", "a"]);

	value = "b";
	index = data.append(value);
	equal(index, 3);
	insert(value, valueOf, index);
	deepEqual(follow(valueOf, next, head, size), ["a", "b", "c", "d"]);
	deepEqual(follow(valueOf, prev, tail, size), ["d", "c", "b", "a"]);

	value = "f";
	index = data.append(value);
	equal(index, 4);
	insert(value, valueOf, index);
	deepEqual(follow(valueOf, next, head, size), ["a", "b", "c", "d", "f"]);
	deepEqual(follow(valueOf, prev, tail, size), ["f", "d", "c", "b", "a"]);

	value = "e";
	index = data.append(value);
	equal(index, 5);
	insert(value, valueOf, index);
	deepEqual(follow(valueOf, next, head, size), ["a", "b", "c", "d", "e", "f"]);
	deepEqual(follow(valueOf, prev, tail, size), ["f", "e", "d", "c", "b", "a"]);

	value = "g";
	index = data.append(value);
	equal(index, 0);
	// evict first
	remove(index);
	insert(value, valueOf, index);
	deepEqual(follow(valueOf, next, head, size), ["a", "b", "d", "e", "f", "g"]);
	deepEqual(follow(valueOf, prev, tail, size), ["g", "f", "e", "d", "b", "a"]);

	value = "b";
	index = data.append(value);
	equal(index, 1);
	remove(index);
	insert(value, valueOf, index);
	deepEqual(follow(valueOf, next, head, size), ["b", "b", "d", "e", "f", "g"]);
	deepEqual(follow(valueOf, prev, tail, size), ["g", "f", "e", "d", "b", "b"]);

	value = "f";
	index = data.append(value);
	equal(index, 2);
	remove(index);
	insert(value, valueOf, index);
	deepEqual(follow(valueOf, next, head, size), ["b", "b", "e", "f", "f", "g"]);
	deepEqual(follow(valueOf, prev, tail, size), ["g", "f", "f", "e", "b", "b"]);

	value = "g";
	index = data.append(value);
	equal(index, 3);
	remove(index);
	insert(value, valueOf, index);
	deepEqual(follow(valueOf, next, head, size), ["b", "e", "f", "f", "g", "g"]);
	deepEqual(follow(valueOf, prev, tail, size), ["g", "g", "f", "f", "e", "b"]);
});

test("load", async () => {
	let data = new CircularBuffer(1_000_000);
	let head = 0;
	let tail = 0;
	let size = 0;
	let next = new Uint32Array(1_000_000); // ideally dynamic arrays
	let prev = new Uint32Array(1_000_000); // ideally dynamic arrays

	function valueOf(point) {
		return data.values[point];
	}

	let _head = 0;
	let _tail = 0;
	let _size = 0;
	let _next = new Uint32Array(1_000_000); // ideally dynamic arrays
	let _prev = new Uint32Array(1_000_000); // ideally dynamic arrays

	function _insert(value, valueOf, index) {
		if (value <= valueOf(_head)) {
			let point = index;
			_next[point] = _head;
			_prev[_head] = point;
			_head = point;
		} else if (value >= valueOf(_tail)) {
			let point = index;
			_next[_tail] = point;
			_prev[point] = _tail;
			_tail = point;
		} else {
			let point = _head;
			let lo = 0;
			let hi = _size;
			while (lo < hi) {
				let _mid = (lo + hi) >>> 1;
				let mid = point;
				for (let i = _mid; i > lo; i--, mid = _next[mid]) {}

				if (valueOf(mid) <= value) {
					point = _next[mid];
					lo = _mid + 1;
				} else {
					hi = _mid;
				}
			}

			_next[_prev[point]] = index;
			_prev[index] = _prev[point];
			_prev[point] = index;
			_next[index] = point;
		}
		_size++;
	}

	function insert(value, valueOf, index) {
		// block size can be constant for each following layer
		// since it's gonna be an increaing fraction of total size
		// of original list
		// 1000000 -> each 512 == 1953 -> each 512 == 3
		// a layer can build its own express lane layer when at size >block*2
		let blockSize = 2048;
		if (value <= valueOf(head)) {
			let point = index;
			next[point] = head;
			prev[head] = point;
			head = point;
		} else if (value >= valueOf(tail)) {
			let point = index;
			next[tail] = point;
			prev[point] = tail;
			tail = point;
		} else {
			let point, lo, hi;

			if (_size > 4) {
				let _p = _head;
				let _l = 0;
				let _h = _size;
				while (_l < _h) {
					let _m = (_l + _h) >>> 1;
					let mid = _p;
					for (let i = _m; i > _l; i--, mid = _next[mid]) {}
					if (valueOf(mid) <= value) {
						_p = _next[mid];
						_l = _m + 1;
					} else {
						_h = _m;
					}
				}
				point = _prev[_p];
				lo = _l * blockSize;
				hi = Math.min(size, lo + blockSize);
			} else {
				point = head;
				lo = 0;
				hi = size;
			}

			// console.log({ point, lo, hi });

			while (lo < hi) {
				let _mid = (lo + hi) >>> 1;
				let mid = point;
				for (let i = _mid; i > lo; i--, mid = next[mid]) {}

				if (valueOf(mid) <= value) {
					point = next[mid];
					lo = _mid + 1;
				} else {
					hi = _mid;
				}
			}

			next[prev[point]] = index;
			prev[index] = prev[point];
			prev[point] = index;
			next[index] = point;
		}
		size++;

		// the problem here occurs under certain pattern
		// if each %block value closer to the previous %block value
		// I will end up with express lane being crowsed in certain area
		// that complicates further search of other unique values
		// if the value _uniquely_ appears at %block pace,
		// most express lane items gonna be just a subset of the main line
		// this creates the need for defining the critera of express lane promo:
		// so I can set either random choice or size driven approach
		// if (size % blockSize === 0) _insert(value, valueOf, index);
		if (size > 64 && Math.random() < 0.0625) _insert(value, valueOf, index);
		// random coefficient going to behave similarly to a block size, in a way that
		// the constant value applied to more layers deep reduces possible size of following express lane by 1/n
		// using random criteria essentially gives me the skiplist implementation (although I still restrict promotion criterias: a bad dice won't create unnecessary levels)
		// with slight difference in memory management: there is no notion of
		// an entity that controls all levels (which may affect search/deletion further?)
		// but just a list that is aware of its own express lane, which in return
		// can made its own express lane, recursively.

		// TODO once I'm done implementing recursive skiplist, I need to test if doing binary search
		// still make sense or I can just compare subsequently instead. It seems like recursive
		// skiplist should provide O(log n) search by its own structure

		// TODO another future research is going to be generating a collection of pointers for range [A..B]
		// to create a bitset result of a filter/search

		// from MIT lecture: if you have n elements in bottom, you want Math.sqrt(n) in the top
	}

	for (let i = 0; i < 1000; i++) {
		let value = (Math.random() * 10) | 0;
		let index = data.append(value);
		insert(value, valueOf, index);
	}
});

test("final", async () => {
	class LinkedRank {
		constructor(capacity) {
			this.capacity = capacity;
			this.head = 0;
			this.tail = 0;
			this.size = 0;
			this.next = new Uint32Array(capacity);
			this.prev = new Uint32Array(capacity);
		}
	}

	function order(a, b) {
		return a < b ? -1 : a > b ? 1 : 0;
	}

	let express = new Map();

	function insert(rank, index, valueOf) {
		let value = valueOf(index);

		if (order(value, valueOf(rank.head)) <= 0) {
			rank.next[index] = rank.head;
			rank.prev[rank.head] = index;
			rank.head = index;
		} else if (order(value, valueOf(rank.tail)) >= 0) {
			rank.next[rank.tail] = index;
			rank.prev[index] = rank.tail;
			rank.tail = index;
		} else {
			let point = search(rank, index, valueOf) ?? rank.head;
			rank.next[rank.prev[point]] = index;
			rank.prev[index] = rank.prev[point];
			rank.prev[point] = index;
			rank.next[index] = point;
		}
		rank.size++;

		if (rank.size > 16 && !express.has(rank)) {
			express.set(rank, new LinkedRank(rank.capacity));
		}
		if (rank.size > 16 && Math.random() < 1 / 16) {
			insert(express.get(rank), index, valueOf);
		}
	}

	function search(rank, index, valueOf) {
		if (rank.size == 0) return null;
		let expr = express.get(rank);
		let point = expr != null && expr.size > 0 ? search(expr, index, valueOf) : rank.head;
		let value = valueOf(index);
		while (order(valueOf(point), value) <= 0 && point !== rank.tail) {
			point = rank.next[point];
		}
		return point;
	}

	function remove(rank, index) {
		if (rank.head === index) {
			rank.head = rank.next[index];
		} else if (rank.tail === index) {
			rank.tail = rank.prev[index];
		} else {
			rank.next[rank.prev[index]] = rank.next[index];
			rank.prev[rank.next[index]] = rank.prev[index];
		}
		rank.size--;
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

	// await new Promise((resolve) => setTimeout(resolve, 10_000));
	// console.log("start");

	data = new CircularBuffer(1_000_000);
	rank = new LinkedRank(1_000_000);

	for (let i = 0; i < 1000000; i++) {
		let value = (Math.random() * 10) | 0;
		let index = data.append(value);
		insert(rank, index, valueOf);
	}

	// console.log("stop");
	// await new Promise((resolve) => setTimeout(resolve, 1000_000));
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
