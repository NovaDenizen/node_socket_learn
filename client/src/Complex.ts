export default class Complex {
    a: number;
    b: number;
    constructor(a?: number, b?: number) {
        if (Number.isNaN(a) || Number.isNaN(b)) {
            console.trace('got NaN in Complex constructor', { a, b });
            throw "NaN's loaded into Complex";
        }
        this.a = a || 0;
        this.b = b || 0;
        Object.freeze(this);
    }
    toString(): string {
        let bsign;
        let b;
        if (this.b < 0) {
            bsign = " - ";
            b = Math.abs(this.b);
        } else {
            bsign = " + ";
            b = this.b;
        }
        return `[${this.a}${bsign}${b}i]`;
    }
    add(other: Complex | number): Complex {
        if (typeof(other) === "number") {
            return new Complex(this.a + other, this.b);
        } else {
            return new Complex(this.a + other.a, this.b + other.b);
        }
    }
    sub(other: Complex): Complex {
        return new Complex(this.a - other.a, this.b - other.b);
    }
    mul(other: Complex): Complex {
        return new Complex(
            this.a * other.a - this.b * other.b,
            this.a * other.b + this.b * other.a
        );
    }
    div(other: Complex): Complex {
        return this.mul(other.invert());
    }
    magSq(): number {
        return (this.a*this.a + this.b*this.b);
    }
    mag(): number {
        return Math.sqrt(this.magSq());
    }
    invert(): Complex {
        const mag2 = this.magSq();
        if (mag2 < 0.0001) {
            throw 'tried to invert Complex 0';
        }
        const invMagSq = 1.0 / this.magSq();
        return new Complex(this.a * invMagSq, -this.b * invMagSq);
    }
    complement(): Complex {
        return new Complex(this.a, -this.b);
    }
    normalize(): Complex {
        const invMag = 1.0 / this.mag();
        return new Complex(this.a * invMag, this.b * invMag);
    }
    neg(): Complex {
        return new Complex(-this.a, -this.b);
    }
    scale(s: number): Complex {
        return new Complex(this.a*s, this.b*s);
    }
    static unit(theta: number): Complex {
        return new Complex(Math.cos(theta), Math.sin(theta));
    }
    static readonly one: Complex = new Complex(1, 0);
    static readonly zero: Complex = new Complex(0, 0);
    static readonly i: Complex = new Complex(0, 1);

}
