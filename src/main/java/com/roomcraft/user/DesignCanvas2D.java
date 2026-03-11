package com.roomcraft.user;

import com.roomcraft.model.FurnitureItem;
import com.roomcraft.model.RoomConfig;

import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.awt.geom.AffineTransform;
import java.awt.geom.Rectangle2D;
import java.util.ArrayList;
import java.util.List;
import java.util.Stack;
import java.util.function.Consumer;

public class DesignCanvas2D extends JPanel
        implements MouseListener, MouseMotionListener, MouseWheelListener {

    private RoomConfig room;
    private final List<FurnitureItem> furniture = new ArrayList<>();
    private FurnitureItem selectedItem = null;

    private double scale = 60.0; // pixels per meter
    private double offsetX = 40;
    private double offsetY = 40;
    private Point lastMouse = null;
    private boolean panning = false;

    private final Stack<List<FurnitureItem>> undoStack = new Stack<>();

    // Callback when selection changes
    private Consumer<FurnitureItem> selectionListener;

    public DesignCanvas2D() {
        setBackground(new Color(20, 30, 50));
        addMouseListener(this);
        addMouseMotionListener(this);
        addMouseWheelListener(this);
        setFocusable(true);
    }

    public void setRoom(RoomConfig room) {
        this.room = room;
        // Center room in view
        offsetX = (getWidth()  - room.width  * scale) / 2;
        offsetY = (getHeight() - room.length * scale) / 2;
        repaint();
    }

    public void setFurnitureList(List<FurnitureItem> items) {
        furniture.clear();
        furniture.addAll(items);
        repaint();
    }

    public List<FurnitureItem> getFurniture() { return furniture; }

    public FurnitureItem getSelected() { return selectedItem; }

    public void setSelectionListener(Consumer<FurnitureItem> l) { this.selectionListener = l; }

    // ---- Undo Support ----
    private void pushUndo() {
        List<FurnitureItem> snapshot = new ArrayList<>();
        for (FurnitureItem f : furniture) snapshot.add(f.copy());
        undoStack.push(snapshot);
    }

    public void undo() {
        if (!undoStack.isEmpty()) {
            List<FurnitureItem> prev = undoStack.pop();
            furniture.clear();
            furniture.addAll(prev);
            selectedItem = null;
            if (selectionListener != null) selectionListener.accept(null);
            repaint();
        }
    }

    public void addFurnitureItem(FurnitureItem item) {
        pushUndo();
        // Place at center of visible canvas
        if (room != null) {
            item.x = room.width / 2.0 - item.width / 2.0;
            item.y = room.length / 2.0 - item.height / 2.0;
        }
        furniture.add(item);
        selectedItem = item;
        if (selectionListener != null) selectionListener.accept(selectedItem);
        repaint();
    }

    public void deleteSelected() {
        if (selectedItem != null) {
            pushUndo();
            furniture.remove(selectedItem);
            selectedItem = null;
            if (selectionListener != null) selectionListener.accept(null);
            repaint();
        }
    }

    // ---- Painting ----
    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2 = (Graphics2D) g;
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

        if (room == null) {
            g2.setColor(new Color(100, 116, 139));
            g2.setFont(new Font("Segoe UI", Font.ITALIC, 18));
            g2.drawString("No room loaded.", 30, 40);
            return;
        }

        double rw = room.width  * scale;
        double rl = room.length * scale;

        // ---- Draw floor ----
        if ("L-Shape".equals(room.shape)) {
            // L: main + right bottom cut
            int[] xs = {(int)offsetX, (int)(offsetX+rw), (int)(offsetX+rw),
                    (int)(offsetX+rw*0.5), (int)(offsetX+rw*0.5), (int)offsetX};
            int[] ys = {(int)offsetY, (int)offsetY, (int)(offsetY+rl*0.5),
                    (int)(offsetY+rl*0.5), (int)(offsetY+rl), (int)(offsetY+rl)};
            g2.setColor(room.floorColor);
            g2.fillPolygon(xs, ys, 6);
            g2.setColor(room.wallColor);
            g2.setStroke(new BasicStroke(3f));
            g2.drawPolygon(xs, ys, 6);
        } else if ("U-Shape".equals(room.shape)) {
            int[] xs = {(int)offsetX, (int)(offsetX+rw*0.35), (int)(offsetX+rw*0.35),
                    (int)(offsetX+rw*0.65), (int)(offsetX+rw*0.65), (int)(offsetX+rw),
                    (int)(offsetX+rw), (int)offsetX};
            int[] ys = {(int)offsetY, (int)offsetY, (int)(offsetY+rl*0.5),
                    (int)(offsetY+rl*0.5), (int)offsetY, (int)offsetY,
                    (int)(offsetY+rl), (int)(offsetY+rl)};
            g2.setColor(room.floorColor);
            g2.fillPolygon(xs, ys, 8);
            g2.setColor(room.wallColor);
            g2.setStroke(new BasicStroke(3f));
            g2.drawPolygon(xs, ys, 8);
        } else {
            // Rectangle
            g2.setColor(room.floorColor);
            g2.fillRect((int)offsetX, (int)offsetY, (int)rw, (int)rl);
            g2.setColor(room.wallColor);
            g2.setStroke(new BasicStroke(4f));
            g2.drawRect((int)offsetX, (int)offsetY, (int)rw, (int)rl);
        }

        // Grid lines
        g2.setStroke(new BasicStroke(0.5f));
        g2.setColor(new Color(255, 255, 255, 30));
        for (double x = offsetX; x <= offsetX + rw; x += scale) {
            g2.drawLine((int)x, (int)offsetY, (int)x, (int)(offsetY + rl));
        }
        for (double y = offsetY; y <= offsetY + rl; y += scale) {
            g2.drawLine((int)offsetX, (int)y, (int)(offsetX + rw), (int)y);
        }

        // Scale label
        g2.setColor(new Color(148, 163, 184));
        g2.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        g2.drawString(String.format("%.1fm x %.1fm  |  1 grid = 1m", room.width, room.length),
                (int)offsetX + 4, (int)(offsetY + rl + 16));

        // ---- Draw furniture ----
        for (FurnitureItem item : furniture) {
            drawFurniture(g2, item);
        }
    }

    private void drawFurniture(Graphics2D g2, FurnitureItem item) {
        double px = offsetX + item.x * scale;
        double py = offsetY + item.y * scale;
        double pw = item.width  * scale;
        double ph = item.height * scale;

        AffineTransform old = g2.getTransform();

        // Rotate around center
        g2.translate(px + pw / 2, py + ph / 2);
        g2.rotate(Math.toRadians(item.rotation));
        g2.translate(-pw / 2, -ph / 2);

        // Fill
        g2.setColor(item.color);
        g2.fillRoundRect(0, 0, (int)pw, (int)ph, 8, 8);

        // Shading
        if (item.shaded) {
            g2.setColor(new Color(0, 0, 0, 60));
            g2.fillRoundRect((int)(pw * 0.55), 4, (int)(pw * 0.4), (int)ph - 8, 6, 6);
            g2.fillRoundRect(4, (int)(ph * 0.55), (int)pw - 8, (int)(ph * 0.4), 6, 6);
        }

        // Border
        boolean isSel = item == selectedItem;
        g2.setStroke(new BasicStroke(isSel ? 2.5f : 1f));
        g2.setColor(isSel ? new Color(96, 165, 250) : item.color.darker());
        g2.drawRoundRect(0, 0, (int)pw, (int)ph, 8, 8);

        // Label
        g2.setColor(Color.WHITE);
        g2.setFont(new Font("Segoe UI", Font.BOLD, Math.max(10, (int)(scale * 0.22))));
        FontMetrics fm = g2.getFontMetrics();
        String label = item.type;
        if (fm.stringWidth(label) > pw - 4) {
            label = label.substring(0, Math.max(1, (int)(pw / fm.charWidth('A')) - 1));
        }
        g2.drawString(label, (int)((pw - fm.stringWidth(label)) / 2), (int)((ph + fm.getAscent()) / 2) - 2);

        g2.setTransform(old);
    }

    // ---- Mouse Events ----
    @Override
    public void mousePressed(MouseEvent e) {
        requestFocusInWindow();
        lastMouse = e.getPoint();

        if (SwingUtilities.isMiddleMouseButton(e)) {
            panning = true;
            return;
        }

        // Check if click hits any furniture (reverse order = top drawn first)
        FurnitureItem hit = null;
        for (int i = furniture.size() - 1; i >= 0; i--) {
            if (hitTest(furniture.get(i), e.getPoint())) {
                hit = furniture.get(i);
                break;
            }
        }
        selectedItem = hit;
        if (selectionListener != null) selectionListener.accept(selectedItem);
        repaint();
    }

    @Override
    public void mouseDragged(MouseEvent e) {
        if (lastMouse == null) return;
        int dx = e.getX() - lastMouse.x;
        int dy = e.getY() - lastMouse.y;
        lastMouse = e.getPoint();

        if (panning || SwingUtilities.isMiddleMouseButton(e)) {
            offsetX += dx; offsetY += dy; repaint(); return;
        }

        if (selectedItem != null) {
            selectedItem.x += dx / scale;
            selectedItem.y += dy / scale;
            // Clamp inside room
            if (room != null) {
                selectedItem.x = Math.max(0, Math.min(room.width  - selectedItem.width,  selectedItem.x));
                selectedItem.y = Math.max(0, Math.min(room.length - selectedItem.height, selectedItem.y));
            }
            if (selectionListener != null) selectionListener.accept(selectedItem);
            repaint();
        } else {
            offsetX += dx; offsetY += dy; repaint();
        }
    }

    @Override
    public void mouseReleased(MouseEvent e) { panning = false; }

    @Override
    public void mouseWheelMoved(MouseWheelEvent e) {
        double factor = (e.getWheelRotation() < 0) ? 1.1 : 0.9;
        double oldScale = scale;
        scale = Math.max(20, Math.min(200, scale * factor));
        // Zoom towards cursor
        offsetX = e.getX() - (e.getX() - offsetX) * (scale / oldScale);
        offsetY = e.getY() - (e.getY() - offsetY) * (scale / oldScale);
        repaint();
    }

    @Override public void mouseClicked(MouseEvent e) {}
    @Override public void mouseEntered(MouseEvent e) {}
    @Override public void mouseExited(MouseEvent e) {}
    @Override public void mouseMoved(MouseEvent e) {}

    private boolean hitTest(FurnitureItem item, Point mouse) {
        double px = offsetX + item.x * scale;
        double py = offsetY + item.y * scale;
        double pw = item.width  * scale;
        double ph = item.height * scale;

        // Transform mouse into item's local coordinate system
        double cx = px + pw / 2, cy = py + ph / 2;
        double mx = mouse.x - cx, my = mouse.y - cy;
        double angle = -Math.toRadians(item.rotation);
        double rx = mx * Math.cos(angle) - my * Math.sin(angle);
        double ry = mx * Math.sin(angle) + my * Math.cos(angle);

        return Math.abs(rx) <= pw / 2 && Math.abs(ry) <= ph / 2;
    }
}
