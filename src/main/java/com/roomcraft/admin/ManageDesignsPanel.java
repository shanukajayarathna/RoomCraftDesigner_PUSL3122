package com.roomcraft.admin;

import com.roomcraft.AppFrame;
import com.roomcraft.db.DatabaseManager;
import com.roomcraft.model.Design;
import com.roomcraft.util.JsonHelper;
import com.roomcraft.util.SessionManager;

import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.util.List;

public class ManageDesignsPanel extends JPanel {

    private final AppFrame appFrame;
    private JTable table;
    private DefaultTableModel model;
    private List<Design> designs;
    private JLabel titleLabel;

    public ManageDesignsPanel(AppFrame appFrame) {
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

    private void buildUI() {
        JPanel topBar = new JPanel(new BorderLayout());
        topBar.setBackground(new Color(30, 41, 59));
        topBar.setBorder(BorderFactory.createEmptyBorder(14, 20, 14, 20));

        titleLabel = new JLabel("Manage All Designs");
        titleLabel.setFont(new Font("Segoe UI", Font.BOLD, 24));
        titleLabel.setForeground(Color.WHITE);
        topBar.add(titleLabel, BorderLayout.WEST);

        JButton backBtn = topBtn("← Admin Dashboard", new Color(71, 85, 105));
        backBtn.addActionListener(e -> {
            SessionManager.filterUserId = -1;
            appFrame.showPanel("ADMIN_DASHBOARD");
        });
        topBar.add(backBtn, BorderLayout.EAST);
        add(topBar, BorderLayout.NORTH);

        String[] cols = {"ID", "Design Name", "Owner", "Date Created"};
        model = new DefaultTableModel(cols, 0) {
            @Override public boolean isCellEditable(int r, int c) { return false; }
        };
        table = new JTable(model);
        table.setBackground(new Color(30, 41, 59));
        table.setForeground(Color.WHITE);
        table.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        table.setRowHeight(36);
        table.setGridColor(new Color(51, 65, 85));
        table.getTableHeader().setBackground(new Color(20, 30, 50));
        table.getTableHeader().setForeground(new Color(148, 163, 184));
        table.getTableHeader().setFont(new Font("Segoe UI", Font.BOLD, 13));
        table.setSelectionBackground(new Color(51, 65, 85));
        table.getColumn("ID").setMaxWidth(50);

        JScrollPane scroll = new JScrollPane(table);
        scroll.setBackground(new Color(15, 23, 42));
        scroll.getViewport().setBackground(new Color(30, 41, 59));
        scroll.setBorder(BorderFactory.createEmptyBorder(15, 20, 5, 20));
        add(scroll, BorderLayout.CENTER);

        // Action buttons below table
        JPanel actionBar = new JPanel(new FlowLayout(FlowLayout.LEFT, 12, 10));
        actionBar.setBackground(new Color(15, 23, 42));
        actionBar.setBorder(BorderFactory.createEmptyBorder(0, 20, 10, 20));

        JButton view3DBtn = actionBtn("🧊 View 3D", new Color(139, 92, 246));
        view3DBtn.addActionListener(e -> {
            int row = table.getSelectedRow();
            if (row < 0) { JOptionPane.showMessageDialog(this, "Select a design first."); return; }
            Design d = designs.get(row);
            SessionManager.currentDesign = d;
            SessionManager.currentRoom = JsonHelper.roomFromJson(d.designDataJson);
            appFrame.showPanel("VIEW_3D");
        });

        JButton deleteBtn = actionBtn("🗑 Delete Design", new Color(239, 68, 68));
        deleteBtn.addActionListener(e -> {
            int row = table.getSelectedRow();
            if (row < 0) { JOptionPane.showMessageDialog(this, "Select a design first."); return; }
            Design d = designs.get(row);
            int confirm = JOptionPane.showConfirmDialog(this,
                "Delete design \"" + d.name + "\"?",
                "Confirm", JOptionPane.YES_NO_OPTION, JOptionPane.WARNING_MESSAGE);
            if (confirm == JOptionPane.YES_OPTION) {
                DatabaseManager.deleteDesign(d.id);
                refresh();
            }
        });

        actionBar.add(view3DBtn); actionBar.add(deleteBtn);
        add(actionBar, BorderLayout.SOUTH);
    }

    public void refresh() {
        model.setRowCount(0);
        if (SessionManager.filterUserId > 0) {
            designs = DatabaseManager.getDesignsByUser(SessionManager.filterUserId);
            titleLabel.setText("Designs by: " + DatabaseManager.getOwnerName(SessionManager.filterUserId));
        } else {
            designs = DatabaseManager.getAllDesigns();
            titleLabel.setText("Manage All Designs");
        }
        for (Design d : designs) {
            String ownerName = DatabaseManager.getOwnerName(d.userId);
            String date = d.dateCreated != null ? d.dateCreated.replace("T"," ") : "";
            model.addRow(new Object[]{d.id, d.name, ownerName, date});
        }
    }

    private JButton topBtn(String t, Color bg) {
        JButton b = new JButton(t);
        b.setBackground(bg); b.setForeground(Color.WHITE);
        b.setFont(new Font("Segoe UI", Font.BOLD, 13));
        b.setBorder(BorderFactory.createEmptyBorder(8, 16, 8, 16));
        b.setFocusPainted(false);
        b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return b;
    }

    private JButton actionBtn(String t, Color bg) {
        JButton b = new JButton(t);
        b.setBackground(bg); b.setForeground(Color.WHITE);
        b.setFont(new Font("Segoe UI", Font.BOLD, 13));
        b.setBorder(BorderFactory.createEmptyBorder(8, 16, 8, 16));
        b.setFocusPainted(false);
        b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return b;
    }
}
