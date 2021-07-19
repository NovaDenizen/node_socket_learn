

// Does the math to set up a tileable polygon in the hyperbolic plane.
//
// sides is the number of sides in the polyogn
// order is the number of polygons that meet at each vertex.
// edgeLength is length of each edge
// vertexRadius is distance from vertex to center of polygon
// edgeRadius is distance from center to an edge's center
// internalAngle is internal angle of polygon
// externalAngle is external angle of polygon
// A 'slice' is a triangle made from two consecutive vertices and the center.
// A slice triangle has two edges of length vertexRadius and one of edgeLength.
// sliceAngle is the angle of a slice triangle at the center point.
// the other two angles of the slice are internalAngle/2.
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
        // what if they specify, say, order-5 or order-6 triangles?  or order-3 hexagons?
        // The right triangle formed by the center, a vertex, and an edge center has angles 
        // PI/2, sliceangle/2, and intenalangle/2.  Triangles in the hyperbolic plane have angle sum <= PI.
        // So sliceangle/2 + internalangle/2 must be <= PI/2,
        // or sliceangle + internalAngle <= PI.
        if (this.internalAngle + this.sliceAngle >= Math.PI) {
            throw new Error("order is too small in PolygonGeometry constructor");
        }
        this.externalAngle = Math.PI - this.internalAngle;
        // A slice triangle has one sliceAngle at the center and two (internalAngle/2) at two vertices.
        const halfInternal = this.internalAngle/2;
        this.edgeLength = PolygonGeometry.triangleSideLength(this.sliceAngle, halfInternal, halfInternal);
        this.vertexRadius = PolygonGeometry.triangleSideLength(halfInternal, this.sliceAngle, halfInternal);
        // this uses a half-slice triangle, with angles sliceAngle/2, right, halfInternal
        this.edgeRadius = PolygonGeometry.triangleSideLength(halfInternal, this.sliceAngle/2, Math.PI/2);

    }
    // Given triangle with angles alpha, beta, gamma, gives the length of
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




