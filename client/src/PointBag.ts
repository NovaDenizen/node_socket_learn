import Complex from "./Complex";
import HypCanvas from "./HypCanvas";

export class Entry<T> {
    readonly p: Complex;
    readonly payload: T;
    constructor(p: Complex, payload: T) {
        this.p = p;
        this.payload = payload;
        Object.freeze(this);
    }
}

// TODO: Better algorithms are possible
export default class PointBag<T> {
    private centers: Entry<T>[] = [];
    constructor() {
        Object.seal(this);
    }
    get length(): number {
        return this.centers.length;
    }
    *search(searchCenter: Complex, searchRadius: number): Generator<Entry<T>> {
        for(const entry of this.centers) {
            if (metric(searchCenter, entry.p) < searchRadius) {
                yield entry;
            }
        }
    }
    any(c: Complex, radius: number): Entry<T> | undefined {
        const it = this.search(c, radius);
        const sr = it.next();
        if (sr.done) {
            return undefined;
        } else {
            return sr.value;
        }
    }
    push(p: Complex, payload: T): void {
        this.centers.push(new Entry(p, payload));
    }

    static metric = metric;
    // organize centers in heap order.
    // centers[i] will be closer to origin than centers[2i+1] and centers[2i+2]
    // centers[0] will be closest of all.
    // runs in O(n)
    heapify() {
        for (let j = this.centers.length-1; j > 0; j--) {
            const i = Math.floor((j-1)/2);
            const ci = this.centers[i];
            const cj = this.centers[j];
            const di = ci.p.magSq();
            const dj = cj.p.magSq();
            if (dj < di) {
                this.centers[i] = cj;
                this.centers[j] = ci;
            }
        }
    }
}

export { PointBag };


function metric(z1: Complex, z2: Complex): number {
    const termNumerator = z1.sub(z2);
    // if |z1| < 1 && |z2| < 1 then this is > 0
    const termDenominator = Complex.one.sub(z1.mul(z2.complement()));
    return 2*Math.atanh(termNumerator.mag() / termDenominator.mag());
}
