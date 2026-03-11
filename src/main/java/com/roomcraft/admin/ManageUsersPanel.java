package com.roomcraft.admin;

import com.roomcraft.AppFrame;
import com.roomcraft.db.DatabaseManager;
import com.roomcraft.model.User;
import com.roomcraft.util.SessionManager;

import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import javax.swing.table.TableCellRenderer;
import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.List;

public class ManageUsersPanel extends JPanel {

    private final AppFrame appFrame;
    private JTable table;
    private DefaultTableModel model;
    private List<User> users;

    public ManageUsersPanel(AppFrame appFrame) {
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
        // Top
        JPanel topBar = new JPanel(new BorderLayout());
        topBar.setBackground(new Color(30, 41, 59));
        topBar.setBorder(BorderFactory.createEmptyBorder(14, 20, 14, 20));

        JLabel title = new JLabel("Manage Users");
        title.setFont(new Font("Segoe UI", Font.BOLD, 24));
        title.setForeground(Color.WHITE);
        topBar.add(title, BorderLayout.WEST);

        JButton backBtn = topBtn("← Admin Dashboard", new Color(71, 85, 105));
        backBtn.addActionListener(e -> appFrame.showPanel("ADMIN_DASHBOARD"));
        topBar.add(backBtn, BorderLayout.EAST);
        add(topBar, BorderLayout.NORTH);

        // Table
        String[] cols = {"ID", "Name", "Email", "Designs", "Actions"};
        model = new DefaultTableModel(cols, 0) {
            @Override public boolean isCellEditable(int r, int c) { return c == 4; }
        };

        table = new JTable(model);
        table.setBackground(new Color(30, 41, 59));
        table.setForeground(Color.WHITE);
        table.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        table.setRowHeight(38);
        table.setGridColor(new Color(51, 65, 85));
        table.getTableHeader().setBackground(new Color(20, 30, 50));
        table.getTableHeader().setForeground(new Color(148, 163, 184));
        table.getTableHeader().setFont(new Font("Segoe UI", Font.BOLD, 13));
        table.setSelectionBackground(new Color(51, 65, 85));

        table.getColumn("Actions").setMinWidth(200);
        table.getColumn("ID").setMaxWidth(50);

        table.getColumn("Actions").setCellRenderer(new ActionRenderer());
        table.getColumn("Actions").setCellEditor(new ActionEditor());

        table.addMouseListener(new MouseAdapter() {
            @Override public void mouseClicked(MouseEvent e) {
                int row = table.getSelectedRow();
                int col = table.getSelectedColumn();
                if (col == 4 && row >= 0) {
                    // handled by editor
                }
            }
        });

        JScrollPane scroll = new JScrollPane(table);
        scroll.setBackground(new Color(15, 23, 42));
        scroll.getViewport().setBackground(new Color(30, 41, 59));
        scroll.setBorder(BorderFactory.createEmptyBorder(15, 20, 15, 20));
        add(scroll, BorderLayout.CENTER);
    }

    public void refresh() {
        model.setRowCount(0);
        users = DatabaseManager.getAllUsers();
        for (User u : users) {
            int count = DatabaseManager.getDesignCountByUser(u.id);
            model.addRow(new Object[]{u.id, u.name, u.email, count, "actions"});
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

    // ---- Renderer for Actions cell ----
    class ActionRenderer implements TableCellRenderer {
        @Override
        public Component getTableCellRendererComponent(JTable table, Object value,
                boolean isSelected, boolean hasFocus, int row, int column) {
            return actionPanel(row);
        }
    }

    // ---- Editor for Actions cell ----
    class ActionEditor extends DefaultCellEditor {
        private JPanel panel;
        private int editingRow;

        ActionEditor() {
            super(new JCheckBox());
        }

        @Override
        public Component getTableCellEditorComponent(JTable table, Object value,
                boolean isSelected, int row, int column) {
            editingRow = row;
            panel = actionPanel(row);
            return panel;
        }

        @Override public Object getCellEditorValue() { return ""; }
        @Override public boolean isCellEditable(java.util.EventObject e) { return true; }
    }

    private JPanel actionPanel(int row) {
        JPanel p = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 4));
        p.setBackground(new Color(30, 41, 59));

        JButton viewBtn = new JButton("View Designs");
        viewBtn.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        viewBtn.setBackground(new Color(59, 130, 246));
        viewBtn.setForeground(Color.WHITE);
        viewBtn.setBorder(BorderFactory.createEmptyBorder(4, 8, 4, 8));
        viewBtn.setFocusPainted(false);
        viewBtn.addActionListener(e -> {
            if (row < users.size()) {
                SessionManager.filterUserId = users.get(row).id;
                appFrame.showPanel("MANAGE_DESIGNS");
            }
        });

        JButton delBtn = new JButton("Delete");
        delBtn.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        delBtn.setBackground(new Color(239, 68, 68));
        delBtn.setForeground(Color.WHITE);
        delBtn.setBorder(BorderFactory.createEmptyBorder(4, 8, 4, 8));
        delBtn.setFocusPainted(false);
        delBtn.addActionListener(e -> {
            if (row < users.size()) {
                int confirm = JOptionPane.showConfirmDialog(ManageUsersPanel.this,
                    "Delete user \"" + users.get(row).name + "\" and all their designs?",
                    "Confirm", JOptionPane.YES_NO_OPTION, JOptionPane.WARNING_MESSAGE);
                if (confirm == JOptionPane.YES_OPTION) {
                    DatabaseManager.deleteUser(users.get(row).id);
                    refresh();
                }
            }
        });

        p.add(viewBtn); p.add(delBtn);
        return p;
    }
}
