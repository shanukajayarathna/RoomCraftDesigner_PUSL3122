package com.roomcraft.renderer;

/**
 * Wavefront OBJ File Loader
 *
 * Parses lines:
 *   "v x y z"        -> vertex positions
 *   "f i j k ..."    -> face indices (1-based, supports v / v/vt / v/vt/vn formats)
 *
 * Methods:
 *   load(String filePath) throws IOException -> returns Mesh
 *   normalize(Mesh mesh)                     -> scales mesh to fit 1x1x1 cube at origin
 *
 * Assigned to: Member 4
 */
public class OBJLoader {
    // TODO: implement load() and normalize()
}
