import Complex from "./Complex";
import HypCanvas from "./HypCanvas";

// TODO: Better algorithms are possible
export default class PointBag<T> {
    private centers: [Complex, T][] = [];
    constructor() {
        Object.seal(this);
    }
    get length(): number {
        return this.centers.length;
    }
    *search(searchCenter: Complex, searchRadius: number): Generator<[Complex, T]> {
        for(const [c,r] of this.centers) {
            if (metric(searchCenter, c) < searchRadius) {
                yield [c, r];
            }
        }
    }
    any(c: Complex, radius: number): [Complex, T] | undefined {
        const it = this.search(c, radius);
        const sr = it.next();
        if (sr.done) {
            return undefined;
        } else {
            return sr.value;
        }
    }
    push(...args: [Complex, T][]): void {
        this.centers.push(...args);
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
            const di = ci[0].magSq();
            const dj = cj[0].magSq();
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
