export default class Complex {
    a: number;
    b: number;
    constructor(a: number, b: number) {
        if (Number.isNaN(a) || Number.isNaN(b)) {
            throw new Error("NaN's loaded into Complex");
        }
        this.a = a;
        this.b = b;
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
    add(other: Complex): Complex {
        return new Complex(this.a + other.a, this.b + other.b);
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
    // a.mulComp(b) is the same as a.mul(b.complement()), but faster.
    // this happens often enough that cluttering the api seems worth it.
    mulComp(other: Complex): Complex {
        return new Complex(
            this.a * other.a + this.b * other.b,
            this.b * other.a - this.a * other.b
        );
    }
    div(other: Complex): Complex {
        // return this.mul(other.invert());
        // (a + bi)/(c + di) = (a + bi)(c - di) / (c + di)(c - di)
        //                   = ((ac + bd) + (bc - ad)i) / (c^2 + d^2)
        const denInv = 1.0 / other.magSq();
        return new Complex((this.a*other.a + this.b*other.b)*denInv, 
                           (this.b*other.a - this.a*other.b)*denInv);
    }
    magSq(): number {
        return (this.a*this.a + this.b*this.b);
    }
    mag(): number {
        return Math.sqrt(this.magSq());
    }
    invert(): Complex {
        const mag2 = this.magSq();
        // I am unsure about commenting this out.  But I don't know exactly where to put this cutoff
        //    if (mag2 < 0.0000001) {
        //        throw 'tried to invert Complex 0';
        //    }
        const invMagSq = 1.0 / this.magSq();
        return new Complex(this.a * invMagSq, -this.b * invMagSq);
    }
    complement(): Complex {
        return new Complex(this.a, -this.b);
    }

    normalize(): Complex {
        return this.scale(1 / this.mag());
    }
    clampRadius(maxRadius: number): Complex {
        const mag = this.mag();
        if (mag <= maxRadius) {
            return this;
        } else if (mag > 0) {
            return this.scale(maxRadius / mag);
        } else {
            return Complex.zero;
        }
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
