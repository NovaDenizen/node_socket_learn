
const TRIVIAL_SIZE = 16; // use simple impl if length < TRIVIAL_SIZE

// A simple O(1) amortized Fifo.
//
// O(1) claim depends on Array.prototype.push() being amortized O(1)
// O(n) behavior of Array.prototype.shift() is avoided by using headIdx.
//
// There's a subtle issue that the user's T type might include undefined, so that
// precludes me from using undefined as a sentinel value.
export default class Fifo<T> {
    private head: (T | undefined)[] = [];
    private headIdx = 0;
    private tail: (T | undefined)[] = [];
    constructor() {
        Object.seal(this);
    }
    push(...args: T[]) {
        this.tail.push(...args);
    }
    shift(): T | undefined {
        this.fixHead();
        if (this.headIdx < this.head.length) {
            // ! is ok because the only way elements get in is through push, 
            // which ensures they are not undefined.
            const res: T = (this.head[this.headIdx])!;
            this.head[this.headIdx] = undefined; // to give GC a fighting chance
            this.headIdx += 1;
            return res;
        } else { // head and tail are empty, no elements
            return undefined;
        }
    }
    *[Symbol.iterator](): Iterable<T> {
        for (let i = this.headIdx; i < this.head.length; i++) {
            // ! is ok because the only way elements get in is through push()
            yield (this.head[i])!;
        }
        for (const x of this.tail) {
            // ! is ok because the only way elements get in is through push()
            yield x!;
        }
    }

    private fixHead(): void {
        if (this.headIdx >= this.head.length && this.tail.length > 0) {
            this.tailToHead();
        }
    }
    private tailToHead(): void {
        this.head = this.tail;
        this.headIdx = 0;
        this.tail = [];
    }
    get length(): number {
        return (this.head.length - this.headIdx + this.tail.length);
    }
}
