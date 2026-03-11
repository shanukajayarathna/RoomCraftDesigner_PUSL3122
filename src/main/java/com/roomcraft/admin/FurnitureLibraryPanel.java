package com.roomcraft.admin;

import com.roomcraft.AppFrame;
import com.roomcraft.db.DatabaseManager;

import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.util.List;

public class FurnitureLibraryPanel extends JPanel {

    private final AppFrame appFrame;
    private JTable table;
    private DefaultTableModel model;

    public FurnitureLibraryPanel(AppFrame appFrame) {
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
        // Top bar
        JPanel topBar = new JPanel(new BorderLayout());
        topBar.setBackground(new Color(30, 41, 59));
        topBar.setBorder(BorderFactory.createEmptyBorder(14, 20, 14, 20));

        JLabel title = new JLabel("🪑  Furniture Library");
        title.setFont(new Font("Segoe UI", Font.BOLD, 24));
        title.setForeground(Color.WHITE);
        topBar.add(title, BorderLayout.WEST);

        JButton backBtn = tBtn("← Admin Dashboard", new Color(71, 85, 105));
        backBtn.addActionListener(e -> appFrame.showPanel("ADMIN_DASHBOARD"));
        topBar.add(backBtn, BorderLayout.EAST);
        add(topBar, BorderLayout.NORTH);

        // Table
        String[] cols = {"ID", "Type Name", "Default Width (m)", "Default Height (m)", "OBJ File Path"};
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
        scroll.getViewport().setBackground(new Color(30, 41, 59));
        scroll.setBorder(BorderFactory.createEmptyBorder(15, 20, 5, 20));
        add(scroll, BorderLayout.CENTER);

        // Action bar
        JPanel actionBar = new JPanel(new FlowLayout(FlowLayout.LEFT, 12, 10));
        actionBar.setBackground(new Color(15, 23, 42));
        actionBar.setBorder(BorderFactory.createEmptyBorder(0, 20, 10, 20));

        JButton addBtn = aBtn("+ Add New Item", new Color(16, 185, 129));
        addBtn.addActionListener(e -> showAddDialog());

        JButton deleteBtn = aBtn("🗑 Delete Selected", new Color(239, 68, 68));
        deleteBtn.addActionListener(e -> {
            int row = table.getSelectedRow();
            if (row < 0) { JOptionPane.showMessageDialog(this, "Select a row first."); return; }
            int id = Integer.parseInt(model.getValueAt(row, 0).toString());
            int confirm = JOptionPane.showConfirmDialog(this,
                "Delete \"" + model.getValueAt(row, 1) + "\"?",
                "Confirm", JOptionPane.YES_NO_OPTION);
            if (confirm == JOptionPane.YES_OPTION) {
                DatabaseManager.deleteFurnitureLibraryItem(id);
                refresh();
            }
        });

        actionBar.add(addBtn); actionBar.add(deleteBtn);
        add(actionBar, BorderLayout.SOUTH);
    }

    private void showAddDialog() {
        JDialog dialog = new JDialog((Frame) null, "Add Furniture Item", true);
        dialog.setLayout(new GridBagLayout());
        dialog.getContentPane().setBackground(new Color(30, 41, 59));
        dialog.setSize(460, 300);
        dialog.setLocationRelativeTo(this);

        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(8, 12, 8, 12);
        c.fill = GridBagConstraints.HORIZONTAL;

        c.gridx = 0; c.gridy = 0; dialog.add(dlgLbl("Type Name:"), c);
        JTextField nameField = dlgField();
        c.gridx = 1; dialog.add(nameField, c);

        c.gridx = 0; c.gridy = 1; dialog.add(dlgLbl("Default Width (m):"), c);
        JSpinner widthSp = new JSpinner(new SpinnerNumberModel(0.6, 0.1, 10.0, 0.1));
        styleSpinner(widthSp);
        c.gridx = 1; dialog.add(widthSp, c);

        c.gridx = 0; c.gridy = 2; dialog.add(dlgLbl("Default Height (m):"), c);
        JSpinner heightSp = new JSpinner(new SpinnerNumberModel(0.6, 0.1, 10.0, 0.1));
        styleSpinner(heightSp);
        c.gridx = 1; dialog.add(heightSp, c);

        c.gridx = 0; c.gridy = 3; dialog.add(dlgLbl("OBJ File (optional):"), c);
        JTextField objField = dlgField();
        objField.setEditable(false);
        JButton browseBtn = new JButton("Browse");
        browseBtn.addActionListener(e -> {
            JFileChooser fc = new JFileChooser();
            fc.setFileFilter(new javax.swing.filechooser.FileNameExtensionFilter("OBJ Files", "obj"));
            if (fc.showOpenDialog(dialog) == JFileChooser.APPROVE_OPTION) {
                objField.setText(fc.getSelectedFile().getAbsolutePath());
            }
        });
        JPanel objRow = new JPanel(new BorderLayout(6, 0));
        objRow.setBackground(new Color(30, 41, 59));
        objRow.add(objField, BorderLayout.CENTER);
        objRow.add(browseBtn, BorderLayout.EAST);
        c.gridx = 1; dialog.add(objRow, c);

        c.gridx = 0; c.gridy = 4; c.gridwidth = 2;
        JPanel btnRow = new JPanel(new FlowLayout(FlowLayout.CENTER, 10, 0));
        btnRow.setBackground(new Color(30, 41, 59));
        JButton saveBtn = new JButton("Save");
        saveBtn.setBackground(new Color(59, 130, 246));
        saveBtn.setForeground(Color.WHITE);
        saveBtn.setFont(new Font("Segoe UI", Font.BOLD, 13));
        saveBtn.addActionListener(e -> {
            String name = nameField.getText().trim();
            if (name.isEmpty()) { JOptionPane.showMessageDialog(dialog, "Enter a type name."); return; }
            double w = (Double) widthSp.getValue();
            double h = (Double) heightSp.getValue();
            String obj = objField.getText().trim();
            DatabaseManager.addFurnitureLibraryItem(name, w, h, obj);
            refresh();
            dialog.dispose();
        });
        JButton cancelBtn = new JButton("Cancel");
        cancelBtn.addActionListener(e -> dialog.dispose());
        btnRow.add(cancelBtn); btnRow.add(saveBtn);
        dialog.add(btnRow, c);

        dialog.setVisible(true);
    }

    private void refresh() {
        model.setRowCount(0);
        List<String[]> items = DatabaseManager.getFurnitureLibrary();
        for (String[] row : items) model.addRow(row);
    }

    private JLabel dlgLbl(String t) {
        JLabel l = new JLabel(t);
        l.setForeground(new Color(148, 163, 184));
        l.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        return l;
    }

    private JTextField dlgField() {
        JTextField f = new JTextField();
        f.setPreferredSize(new Dimension(200, 34));
        f.setBackground(new Color(51, 65, 85));
        f.setForeground(Color.WHITE); f.setCaretColor(Color.WHITE);
        f.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        f.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(new Color(71, 85, 105)),
            BorderFactory.createEmptyBorder(4, 8, 4, 8)));
        return f;
    }

    private void styleSpinner(JSpinner sp) {
        sp.setPreferredSize(new Dimension(200, 34));
        JSpinner.DefaultEditor ed = (JSpinner.DefaultEditor) sp.getEditor();
        ed.getTextField().setBackground(new Color(51, 65, 85));
        ed.getTextField().setForeground(Color.WHITE);
        ed.getTextField().setFont(new Font("Segoe UI", Font.PLAIN, 13));
    }

    private JButton tBtn(String t, Color bg) {
        JButton b = new JButton(t);
        b.setBackground(bg); b.setForeground(Color.WHITE);
        b.setFont(new Font("Segoe UI", Font.BOLD, 13));
        b.setBorder(BorderFactory.createEmptyBorder(8, 16, 8, 16));
        b.setFocusPainted(false);
        b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return b;
    }

    private JButton aBtn(String t, Color bg) {
        JButton b = new JButton(t);
        b.setBackground(bg); b.setForeground(Color.WHITE);
        b.setFont(new Font("Segoe UI", Font.BOLD, 13));
        b.setBorder(BorderFactory.createEmptyBorder(8, 16, 8, 16));
        b.setFocusPainted(false);
        b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return b;
    }
}
