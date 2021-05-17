
export default class Complex {
    a: number;
    b: number;
    constructor(a?: number, b?: number) {
        if (b !== undefined) {
            this.b = b;
        } else {
            this.b = 0;
        }
        if (a !== undefined) {
            this.a = a;
        } else {
            this.a = 0;
        }
        Object.freeze(this);
    }
    toString(): string {
        let bsign;
        let b;
        if (this.b < 0) {
            bsign = ' - ';
            b = Math.abs(this.b);
        } else {
            bsign = ' + ';
            b = this.b;
        }
        return `[${this.a}${bsign}${b}i]`;
    }
}
