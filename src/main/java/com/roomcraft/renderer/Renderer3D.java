package com.roomcraft.renderer;

/**
 * Software 3D Renderer using Java Graphics2D only (no external 3D library)
 *
 * Algorithm:
 *  1. Perspective projection: 3D world coords -> 2D screen coords
 *  2. Painter's algorithm: sort faces back-to-front by average Z depth
 *  3. Face shading: dot product of face normal with light direction vector
 *
 * Camera fields: yaw (double), pitch (double), distance (double), lightAngle (double)
 *
 * Main method: render(Graphics2D, width, height, RoomConfig, List<FurnitureItem>, Map<String,Mesh>)
 *   - Draws floor, ceiling, 4 walls as quads
 *   - Draws each furniture item as a 6-face box (or OBJ mesh if available)
 *
 * Assigned to: Member 4
 */
public class Renderer3D {
    // TODO: implement camera fields and render()
}
