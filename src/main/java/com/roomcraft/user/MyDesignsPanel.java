package com.roomcraft.user;

import com.roomcraft.AppFrame;
import com.roomcraft.db.DatabaseManager;
import com.roomcraft.model.Design;
import com.roomcraft.util.JsonHelper;
import com.roomcraft.util.SessionManager;

import javax.swing.*;
import java.awt.*;
import java.util.List;

public class MyDesignsPanel extends JPanel {

    private final AppFrame appFrame;
    private JPanel listPanel;

    public MyDesignsPanel(AppFrame appFrame) {
        this.appFrame = appFrame;
        setBackground(new Color(15, 23, 42));
        setLayout(new BorderLayout());
        buildUI();
    }

    @Override
    public void addNotify() {
        super.addNotify();
        refresh();
    }

    public void refresh() {
        listPanel.removeAll();
        if (SessionManager.currentUser == null) return;
        List<Design> designs = DatabaseManager.getDesignsByUser(SessionManager.currentUser.id);
        if (designs.isEmpty()) {
            JLabel none = new JLabel("No designs yet. Create your first room!", SwingConstants.CENTER);
            none.setForeground(new Color(100, 116, 139));
            none.setFont(new Font("Segoe UI", Font.ITALIC, 16));
            listPanel.add(none);
        } else {
            for (Design d : designs) {
                listPanel.add(designCard(d));
                listPanel.add(Box.createVerticalStrut(10));
            }
        }
        listPanel.revalidate();
        listPanel.repaint();
    }

    private void buildUI() {
        // Top bar
        JPanel topBar = new JPanel(new BorderLayout());
        topBar.setBackground(new Color(30, 41, 59));
        topBar.setBorder(BorderFactory.createEmptyBorder(14, 20, 14, 20));

        JLabel title = new JLabel("My Designs");
        title.setFont(new Font("Segoe UI", Font.BOLD, 24));
        title.setForeground(Color.WHITE);
        topBar.add(title, BorderLayout.WEST);

        JPanel btns = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
        btns.setBackground(new Color(30, 41, 59));
        JButton newBtn = actionBtn("+ New Design", new Color(59, 130, 246));
        newBtn.addActionListener(e -> {
            SessionManager.currentDesign = null;
            SessionManager.currentRoom = null;
            appFrame.showPanel("ROOM_SETUP");
        });
        JButton backBtn = actionBtn("← Dashboard", new Color(71, 85, 105));
        backBtn.addActionListener(e -> appFrame.showPanel("USER_DASHBOARD"));
        btns.add(backBtn); btns.add(newBtn);
        topBar.add(btns, BorderLayout.EAST);
        add(topBar, BorderLayout.NORTH);

        // Scrollable list
        listPanel = new JPanel();
        listPanel.setLayout(new BoxLayout(listPanel, BoxLayout.Y_AXIS));
        listPanel.setBackground(new Color(15, 23, 42));
        listPanel.setBorder(BorderFactory.createEmptyBorder(15, 25, 15, 25));

        JScrollPane scroll = new JScrollPane(listPanel);
        scroll.setBackground(new Color(15, 23, 42));
        scroll.getViewport().setBackground(new Color(15, 23, 42));
        scroll.setBorder(BorderFactory.createEmptyBorder());
        scroll.getVerticalScrollBar().setUnitIncrement(12);
        add(scroll, BorderLayout.CENTER);
    }

    private JPanel designCard(Design d) {
        JPanel card = new JPanel(new BorderLayout(10, 0));
        card.setBackground(new Color(30, 41, 59));
        card.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(new Color(51, 65, 85)),
            BorderFactory.createEmptyBorder(14, 18, 14, 18)
        ));
        card.setMaximumSize(new Dimension(Integer.MAX_VALUE, 80));
        card.setAlignmentX(Component.LEFT_ALIGNMENT);

        // Left: name + date
        JPanel info = new JPanel(new GridLayout(2, 1, 0, 4));
        info.setBackground(new Color(30, 41, 59));
        JLabel name = new JLabel(d.name);
        name.setFont(new Font("Segoe UI", Font.BOLD, 16));
        name.setForeground(Color.WHITE);
        String dateStr = d.dateCreated != null ? d.dateCreated.replace("T", " ") : "";
        JLabel date = new JLabel("🕐 " + dateStr);
        date.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        date.setForeground(new Color(100, 116, 139));
        info.add(name); info.add(date);
        card.add(info, BorderLayout.CENTER);

        // Right: buttons
        JPanel actions = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
        actions.setBackground(new Color(30, 41, 59));

        JButton editBtn = cardBtn("✏ Edit", new Color(59, 130, 246));
        editBtn.addActionListener(e -> {
            SessionManager.currentDesign = d;
            SessionManager.currentRoom = JsonHelper.roomFromJson(d.designDataJson);
            appFrame.showPanel("WORKSPACE_2D");
        });

        JButton view3D = cardBtn("🧊 3D View", new Color(139, 92, 246));
        view3D.addActionListener(e -> {
            SessionManager.currentDesign = d;
            SessionManager.currentRoom = JsonHelper.roomFromJson(d.designDataJson);
            appFrame.showPanel("VIEW_3D");
        });

        JButton delBtn = cardBtn("🗑 Delete", new Color(239, 68, 68));
        delBtn.addActionListener(e -> {
            int confirm = JOptionPane.showConfirmDialog(this,
                "Delete \"" + d.name + "\"? This cannot be undone.",
                "Confirm Delete", JOptionPane.YES_NO_OPTION, JOptionPane.WARNING_MESSAGE);
            if (confirm == JOptionPane.YES_OPTION) {
                DatabaseManager.deleteDesign(d.id);
                refresh();
            }
        });

        actions.add(editBtn); actions.add(view3D); actions.add(delBtn);
        card.add(actions, BorderLayout.EAST);
        return card;
    }

    private JButton actionBtn(String text, Color bg) {
        JButton b = new JButton(text);
        b.setBackground(bg); b.setForeground(Color.WHITE);
        b.setFont(new Font("Segoe UI", Font.BOLD, 13));
        b.setBorder(BorderFactory.createEmptyBorder(8, 16, 8, 16));
        b.setFocusPainted(false);
        b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return b;
    }

    private JButton cardBtn(String text, Color bg) {
        JButton b = new JButton(text);
        b.setBackground(bg); b.setForeground(Color.WHITE);
        b.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        b.setBorder(BorderFactory.createEmptyBorder(5, 12, 5, 12));
        b.setFocusPainted(false);
        b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return b;
    }
}
