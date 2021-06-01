import { sprintf } from "sprintf-js";


// edgeLength is length of each edge
// vertexRadius is distance from vertex to center of polygon
// edgeRadius is distance from center to center of edge
// internalAngle is internal angle of polygon
// externalAngle is external angle of polygon
// slices is 
export class PolygonGeometry {
    readonly edgeLength: number; 
    readonly internalAngle: number; 
    readonly externalAngle: number; 
    readonly vertexRadius: number; 
    readonly edgeRadius: number;
    readonly sliceAngle: number;
    readonly sides: number;
    readonly order: number;
    constructor(sides: number, order: number) {
        this.sides = sides;
        this.order = order;
        this.internalAngle= 2*Math.PI/order;

        this.sliceAngle = 2*Math.PI/sides;
        if (sides < 3) {
            throw new Error("not enough sides in PolygonGeometry constructor");
        }
        if (this.internalAngle + this.sliceAngle >= Math.PI) {
            throw new Error("order is too small in PolygonGeometry constructor");
        }
        this.externalAngle = Math.PI - this.internalAngle;
        // A slice triangle has one sliceAngle at the center and two (internalAngle/2) at two vertices.
        const halfInternal = this.internalAngle/2;
        this.edgeLength = PolygonGeometry.triangleSideLength(this.sliceAngle, halfInternal, halfInternal);
        this.vertexRadius = PolygonGeometry.triangleSideLength(halfInternal, this.sliceAngle, halfInternal);
        // this uses a half-slice triangle, with angles sliceAngle/2, 90, halfInternal
        this.edgeRadius = PolygonGeometry.triangleSideLength(halfInternal, this.sliceAngle/2, Math.PI/2);

        Object.freeze(this);
    }
    // Given triangle with angles alpha, beta, gamma, gives the side length of
    // the side opposite alpha.
    static triangleSideLength(alpha: number, beta: number, gamma: number): number { 
        if (alpha + beta + gamma >= Math.PI ||
            alpha <= 0 ||
            beta <= 0 ||
            gamma <= 0) {
            throw new Error(`invalid triangle angles passed to triangleSideLength (${alpha}, ${beta}, ${gamma})`);
        }
        /*
            hyperbolic law of cosines (k=1):
                for any triangle with internal angles alpha, beta, gamma and side a opposite alpha:
                    cos(alpha) = -cos(beta)cos(gamma) + sin(beta)sin(gamma)cosh(a)
                    cos(alpha) + cos(beta)cos(gamma) = sin(beta)sin(gamma)cosh(a)
                    (cos(alpha) + cos(beta)cos(gamma))/(sin(beta)sin(gamm)) = cosh(a)
                    a = arccosh((cos(alpha) + cos(beta)cos(gamma))/(sin(beta)sin(gamm)));
        */
        const cos = Math.cos;
        const sin = Math.sin;
        const a: number = Math.acosh((cos(alpha) + cos(beta)*cos(gamma))/(sin(beta)*sin(gamma)));
        return a;
    };
};




