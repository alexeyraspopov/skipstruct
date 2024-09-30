# Skip List

> Skip lists are a probabilistic data structure that seem likely to supplant
> balanced trees as the implementation method of choice for many applications.
> Skip list algorithms have the same asymptotic expected time bounds as balanced
> trees and are simpler, faster and use less space.  
> — William Pugh, Concurrent Maintenance of Skip Lists (1989)

# Cost-effective streamed data storing while maintaining efficient search/filter capabilities

These are research and development notes on my ideas and thoughts as I attempt
to resolve a defined problem in a JavaScript while looking for solutions that
have the lowest overhead with regard to memory management and runtime cost. The
solution must be able to handle millions of records and different volumes of
incoming records.

While the solution for storing a stream of data, either as a capped buffer or
unbound stream, the solution is almost obvious [^circular-buffer-wiki]. But to
extract value from the buffered data, there's gotta be a solution that indexes
arbitrary dimensions of records in question, allowing search, range and subset
filters. The problem is well researched and plenty of algorithms, structures,
and implementations exist. Though some of those struggle to remain efficient
when applied to browser environments and JavaScript with its memory quirks in
particular.

When testing certain assumptions about maintaining an index, I ended up with a
particular pointers-like system that matches performance of lower level
languages (some details on this later). As I went further with experiments
around using this pointer system for building a linked list that stores values
in sorted order, I eventually re-discovered skip list data structure
[^skip-list-wiki]. It is also one of those data structures that can be
efficiently implemented in languages like Go or C where you have better memory
management capabilities. When implemented as is in JavaScript it may easily
loose its performance benefits. I applied my findings of a pointer-like system
to the skip list and got an implementation that is up to the real world
challenge now.

## The Problem

You're a frontend engineers presented with a task to display certain JSON
records that coming your way from a server at certain polling speed (in batches
of couple of hundreds records) or even through a WebSocket. The payload size is
unknown and hard to predict, so putting general artificial constraints wrt how
many records can be handled at the time is only going to make UX worse. Let's
assume the users are the ones to make decision whether to put the upper limit as
they can change their mind any time, reacting to the state of UI they see.

Let's say the data is displayed in a table with pagination or infinite
scrolling, and it has controls to perform text search, or filter by range of
metric A, or filter by a subset of category B, all coming from the internal
value of streamed records. According to RAIL model [^rail-model], you'd want to
optimize the response, meaning the user's request to apply filter should lead to
result without a delay significant enough to be percepted.

Given modern hardware and state of art JavaScript engines optimizations, at
certain volume of data you can do just fine here by writing idiomatic
JavaScript: doing `.push()`, `.shift()`, or `.splice()` for managing data
buffer, and `.filter()`, `.find()`, etc for filtering and search. This approach
however approaches its limits at considerably low real world data volumes. We're
talking about just 2000-5000 records really, regardless of their value size.
Frequent use of mentioned methods as the new data comes in reveals the essence
of JavaScript memory management being heap only and GC being your enemy number
one. To build a web UI that effortlessly handles large volumes of data while
still being fully responsive to the user's input requires certain strategic
planning and careful execution.

## Keeping records in memory

Well, there isn't much of an option here other than `Array`. You receive a
record, you `.push()` it to the end of already stored records. Not much to
reinvent here as you need to iterate over those records or access them
arbitrary.

Now you're being tasked to implement a limit of records being stored at any
time. You start with an empty array, you put new records in. Then you hit the
limit. This doesn't mean the records stop coming in, you just now need to do
extra work to only show the last `N` records as a sort of "moving window", since
you can't just stop and only show the user those records as static data.

What would be an approach in idiomatic JavaScript? Probably to keep pushing
records to the end, and after processing a fresh batch do something like
`records = records.slice(-limit)` only keeping array of last `limit` items.
Simple and easy, in terms of the code commited. But this will triggering garbage
collection cycle that may get longer at larget limits, completely freezing the
web page. Depending on the rate of incoming records, the user most likely to
experience those micro freezes during scrolling, typing, interacting with filter
controls. Even if you may think that doing `.push()` + `.shift()` may possibly
have smaller damage than using splice method, you didn't get the actual problem
here.

I didn't really need to invent any sophisticated new data structures here, nor
did I need to hack around JavaScript garbage collection mechanisms. There is a
data structure out there that is designed for this exact use case:
[Circular Buffer](https://en.wikipedia.org/wiki/Circular_buffer). In JavaScript
it can still be represented with a plain Array, and when the number of records
added to the array approaches the defined limit, the circular buffer starts
overwriting the oldest records, going in circles. Not only this means that we
don't waste CPU cycles on `.push()` after reaching the top limit, we also do not
need to do extra memory manipulation to keep array as "last `N` elements". GC
still going to collection those records that were overwritten, but that's the
price we're paying regardless of the method and the number of records collected
equals to the rate of records consumed, not the total size of array. The
implementation of circular buffer is so easy, it's never going to be a source of
bugs or maintenance issues. It's an effortless approach in writing to an array
that has exact benefits we're looking for with pretty much inexistent overhead.

## If only the sorting algorithms were faster

My most favorite algorithm is probably
[Binary Search](https://en.wikipedia.org/wiki/Binary_search). It is simple,
easy, yet so efficient you just can't think how a thing can get any faster.
Throw any theoretical volumes of data at it, bam, here's the thing you're
searching in it. It's really just wiser to design your data around ability to
apply binary search, instead of coming up with other search algorithms. Same
idea behind binary trees and all their variety.

So when it comes to implementing search and filter capabilities for arbitrary
data, I gotta think of a way to organize necessary dimensions or metrics of that
data in the way where I can then apply binary search. If I had a batch of
records immediately at once, and I knew that the user would keep filtering it
with different params over and over, potentially applying cross filter, I would
just sort necessary values in particular order so then I can simply apply binary
search: for range filter it's just about doing two binary searches to find left
most item and right most item. Similarly for subset categorical filter, left and
right bounds of a single value would give you the range of items that share a
dimension value.

But that's really only works if I got a batch of data of any volume at once, no
streaming. Here, records comming in at certain pace with unknown patterns of
internal value. I cannot just append pre-sorted lists, nor I can apply sort
specifically to the new small batch and then append it to the rest. The only
option I got is to sort everything again. This becomes absolutely inefficient
very quickly. Forget about garbage collection overhead, or extra space needed
for algorithms to work, it's just `.sort()` that is going to kill the UX. No,
you can't get faster than the sort algorithm we have in JavaScript. Yes, I did
test some. The native one is well done, so just accept its performance. We gotta
get back to the drawing board and think about a different way from scratch.
Something that may still be as efficient as binary search, because, nothing is
better than that.

## Linked lists and generational JavaScript trauma

To be continued...

<!-- ... why linked lists in javascript are not the same as in C -->

## References

[^circular-buffer-wiki]:
    [Circular buffer, Wikipedia article](https://en.wikipedia.org/wiki/Circular_buffer).

[^skip-list-wiki]: [Skip list, Wikipedia article](https://en.wikipedia.org/wiki/Skip_list).
[^rail-model]:
    [Measure performance with the RAIL model, web.dev article](https://web.dev/articles/rail).

[^pugh-paper]:
    ["Skip Lists: A Probabilistic Alternative to Balanced Trees", William Pugh](https://15721.courses.cs.cmu.edu/spring2018/papers/08-oltpindexes1/pugh-skiplists-cacm1990.pdf)

[^mit-lecture]:
    ["Randomization: Skip Lists", Srinivas Devadas, MIT 6.046J Design and Analysis of Algorithms, Spring 2015](https://www.youtube.com/watch?v=2g9OSRKJuzM)

[^lru-link]:
    ["Implementing an efficient LRU cache in JavaScript", Guillaume Plique](https://yomguithereal.github.io/posts/lru-cache)
