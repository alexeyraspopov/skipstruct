Set of efficient data structures based on skip lists.

    npm install skipstruct

> Skip lists are a probabilistic data structure that seem likely to supplant balanced trees as the
> implementation method of choice for many applications. Skip list algorithms have the same
> asymptotic expected time bounds as balanced trees and are simpler, faster and use less space.
>
> — William Pugh, Concurrent Maintenance of Skip Lists (1989)

Provided skip list implementation is the most efficient out there in terms of memory and CPU
consumption. What makes it so good is a custom pointer system [originally described][pointer-system]
by Guillaume Plique.

```js
import { FixedSkipList } from "skipstruct";

let ascending = (a, b) => (a == b ? 0 : a < b ? -1 : a > b ? 1 : 0);

let capacity = 1000;

let values = [];
let byYear = new FixedSkipList(capacity, 1 / 2, (a, b) => {
  return ascending(values[a].year, values[b].year);
});
let byCountry = new FixedSkipList(capacity, 1 / 4, (a, b) => {
  return ascending(values[a].country, values[b].country);
});

function append(value) {
  let index = values.push(value) - 1;
  byYear.insert(index);
  byCountry.insert(index);
}

append({ year: 1939, country: "Italy" });
append({ year: 1926, country: "Germany" });
append({ year: 1899, country: "France" });
append({ year: 1913, country: "England" });
```

Iterating over skip lists going to provide indices of values in defined order:

```js
for (let index of byYear) {
  console.log(values[index].year);
}
// > 1899, 1913, 1926, 1939

for (let index of byCountry) {
  console.log(values[index].country);
}
// > England, France, Germany, Italy
```

[pointer-system]: https://yomguithereal.github.io/posts/lru-cache#a-custom-pointer-system
