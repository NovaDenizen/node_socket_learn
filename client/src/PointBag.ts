import Complex from "./Complex";
import HypCanvas from "./HypCanvas";

// TODO: Better algorithms are possible
export default class PointBag<T> {
    private centers: [Complex, T][] = [];
    constructor() {
        Object.seal(this);
    }
    *search(searchCenter: Complex, searchRadius: number): Generator<[Complex, T], any, any> {
        const it = this.centers[Symbol.iterator]();
        for(let v = it.next(); !v.done; v = it.next()) {
            const [c,r] = v.value;
            if (HypCanvas.metric(searchCenter, c) < searchRadius) {
                yield [c, r];
            }
        }
    }
    any(c: Complex, radius: number): [Complex, T] | undefined {
        let it = this.search(c, radius);
        let sr = it.next();
        if (sr.done) {
            return undefined;
        } else {
            return sr.value;
        }
    }
    push(...args: [Complex, T][]): void {
        this.centers.push(...args);
    }
}
