package com.roomcraft.user;

import com.roomcraft.AppFrame;
import com.roomcraft.model.RoomConfig;
import com.roomcraft.util.SessionManager;

import javax.swing.*;
import java.awt.*;

public class RoomSetupPanel extends JPanel {

    private final AppFrame appFrame;
    private JTextField nameField;
    private JSpinner widthSpinner, lengthSpinner, heightSpinner;
    private JComboBox<String> shapeCombo, themeCombo;
    private Color wallColor = new Color(245, 245, 220);
    private Color floorColor = new Color(139, 90, 43);
    private JLabel wallColorPreview, floorColorPreview;

    public RoomSetupPanel(AppFrame appFrame) {
        this.appFrame = appFrame;
        setBackground(new Color(15, 23, 42));
        setLayout(new GridBagLayout());
        buildUI();
    }

    @Override
    public void addNotify() {
        super.addNotify();
        // Pre-fill if editing existing design
        if (SessionManager.currentRoom != null) {
            RoomConfig r = SessionManager.currentRoom;
            nameField.setText(r.name);
            widthSpinner.setValue(r.width);
            lengthSpinner.setValue(r.length);
            heightSpinner.setValue(r.height);
            shapeCombo.setSelectedItem(r.shape);
            themeCombo.setSelectedItem(r.theme);
            wallColor = r.wallColor; wallColorPreview.setBackground(wallColor);
            floorColor = r.floorColor; floorColorPreview.setBackground(floorColor);
        }
    }

    private void buildUI() {
        JPanel card = new JPanel(new GridBagLayout());
        card.setBackground(new Color(30, 41, 59));
        card.setBorder(BorderFactory.createEmptyBorder(30, 40, 30, 40));
        card.setPreferredSize(new Dimension(500, 580));

        GridBagConstraints c = new GridBagConstraints();
        c.fill = GridBagConstraints.HORIZONTAL;
        c.insets = new Insets(6, 0, 6, 0);
        c.gridx = 0; c.gridwidth = 2;

        JLabel title = new JLabel("Room Setup", SwingConstants.CENTER);
        title.setFont(new Font("Segoe UI", Font.BOLD, 26));
        title.setForeground(Color.WHITE);
        c.gridy = 0; card.add(title, c);

        c.gridwidth = 1;
        c.gridy = 1; c.gridx = 0; card.add(lbl("Room Name"), c);
        nameField = field("My Living Room");
        c.gridx = 1; card.add(nameField, c);

        c.gridy = 2; c.gridx = 0; card.add(lbl("Width (m)"), c);
        widthSpinner = new JSpinner(new SpinnerNumberModel(5.0, 1.0, 20.0, 0.5));
        styleSpinner(widthSpinner);
        c.gridx = 1; card.add(widthSpinner, c);

        c.gridy = 3; c.gridx = 0; card.add(lbl("Length (m)"), c);
        lengthSpinner = new JSpinner(new SpinnerNumberModel(4.0, 1.0, 20.0, 0.5));
        styleSpinner(lengthSpinner);
        c.gridx = 1; card.add(lengthSpinner, c);

        c.gridy = 4; c.gridx = 0; card.add(lbl("Height (m)"), c);
        heightSpinner = new JSpinner(new SpinnerNumberModel(2.8, 2.0, 5.0, 0.1));
        styleSpinner(heightSpinner);
        c.gridx = 1; card.add(heightSpinner, c);

        c.gridy = 5; c.gridx = 0; card.add(lbl("Room Shape"), c);
        shapeCombo = new JComboBox<>(new String[]{"Rectangle", "L-Shape", "U-Shape"});
        styleCombo(shapeCombo);
        c.gridx = 1; card.add(shapeCombo, c);

        c.gridy = 6; c.gridx = 0; card.add(lbl("Theme"), c);
        themeCombo = new JComboBox<>(new String[]{"Modern", "Classic", "Minimalist", "Industrial"});
        styleCombo(themeCombo);
        c.gridx = 1; card.add(themeCombo, c);

        // Wall colour
        c.gridy = 7; c.gridx = 0; card.add(lbl("Wall Colour"), c);
        JPanel wallRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        wallRow.setBackground(new Color(30, 41, 59));
        wallColorPreview = new JLabel("   ");
        wallColorPreview.setOpaque(true);
        wallColorPreview.setBackground(wallColor);
        wallColorPreview.setPreferredSize(new Dimension(40, 28));
        wallColorPreview.setBorder(BorderFactory.createLineBorder(Color.GRAY));
        JButton wallBtn = smallBtn("Pick");
        wallBtn.addActionListener(e -> {
            Color c2 = JColorChooser.showDialog(this, "Choose Wall Colour", wallColor);
            if (c2 != null) { wallColor = c2; wallColorPreview.setBackground(c2); }
        });
        wallRow.add(wallColorPreview); wallRow.add(wallBtn);
        c.gridx = 1; card.add(wallRow, c);

        // Floor colour
        c.gridy = 8; c.gridx = 0; card.add(lbl("Floor Colour"), c);
        JPanel floorRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        floorRow.setBackground(new Color(30, 41, 59));
        floorColorPreview = new JLabel("   ");
        floorColorPreview.setOpaque(true);
        floorColorPreview.setBackground(floorColor);
        floorColorPreview.setPreferredSize(new Dimension(40, 28));
        floorColorPreview.setBorder(BorderFactory.createLineBorder(Color.GRAY));
        JButton floorBtn = smallBtn("Pick");
        floorBtn.addActionListener(e -> {
            Color c2 = JColorChooser.showDialog(this, "Choose Floor Colour", floorColor);
            if (c2 != null) { floorColor = c2; floorColorPreview.setBackground(c2); }
        });
        floorRow.add(floorColorPreview); floorRow.add(floorBtn);
        c.gridx = 1; card.add(floorRow, c);

        // Buttons
        c.gridy = 9; c.gridx = 0; c.gridwidth = 2;
        JPanel btnRow = new JPanel(new FlowLayout(FlowLayout.CENTER, 15, 0));
        btnRow.setBackground(new Color(30, 41, 59));
        JButton createBtn = styledBtn("Create Room", new Color(59, 130, 246));
        createBtn.addActionListener(e -> doCreate());
        JButton cancelBtn = styledBtn("Cancel", new Color(71, 85, 105));
        cancelBtn.addActionListener(e -> appFrame.showPanel("USER_DASHBOARD"));
        btnRow.add(cancelBtn); btnRow.add(createBtn);
        card.add(btnRow, c);

        add(card, new GridBagConstraints());
    }

    private void doCreate() {
        String name = nameField.getText().trim();
        if (name.isEmpty()) { JOptionPane.showMessageDialog(this, "Enter a room name."); return; }
        double w = (Double) widthSpinner.getValue();
        double l = (Double) lengthSpinner.getValue();
        double h = (Double) heightSpinner.getValue();
        String shape = (String) shapeCombo.getSelectedItem();
        String theme = (String) themeCombo.getSelectedItem();
        SessionManager.currentRoom = new RoomConfig(name, w, l, h, shape, wallColor, floorColor, theme);
        appFrame.showPanel("WORKSPACE_2D");
    }

    private JLabel lbl(String t) {
        JLabel l = new JLabel(t);
        l.setForeground(new Color(148, 163, 184));
        l.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        l.setPreferredSize(new Dimension(120, 30));
        return l;
    }

    private JTextField field(String placeholder) {
        JTextField f = new JTextField(placeholder);
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
        sp.setBackground(new Color(51, 65, 85));
        sp.setBorder(BorderFactory.createLineBorder(new Color(71, 85, 105)));
        ((JSpinner.DefaultEditor) sp.getEditor()).getTextField().setBackground(new Color(51, 65, 85));
        ((JSpinner.DefaultEditor) sp.getEditor()).getTextField().setForeground(Color.WHITE);
        ((JSpinner.DefaultEditor) sp.getEditor()).getTextField().setFont(new Font("Segoe UI", Font.PLAIN, 13));
    }

    private void styleCombo(JComboBox<String> cb) {
        cb.setPreferredSize(new Dimension(200, 34));
        cb.setBackground(new Color(51, 65, 85));
        cb.setForeground(Color.WHITE);
        cb.setFont(new Font("Segoe UI", Font.PLAIN, 13));
    }

    private JButton smallBtn(String t) {
        JButton b = new JButton(t);
        b.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        b.setBackground(new Color(71, 85, 105));
        b.setForeground(Color.WHITE);
        b.setBorder(BorderFactory.createEmptyBorder(4, 10, 4, 10));
        b.setFocusPainted(false);
        b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return b;
    }

    private JButton styledBtn(String text, Color bg) {
        JButton btn = new JButton(text) {
            @Override protected void paintComponent(Graphics g) {
                Graphics2D g2 = (Graphics2D) g.create();
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g2.setColor(getModel().isPressed() ? bg.darker() : bg);
                g2.fillRoundRect(0,0,getWidth(),getHeight(),10,10);
                g2.setColor(Color.WHITE); g2.setFont(getFont());
                FontMetrics fm = g2.getFontMetrics();
                g2.drawString(getText(),(getWidth()-fm.stringWidth(getText()))/2,
                        (getHeight()+fm.getAscent()-fm.getDescent())/2);
                g2.dispose();
            }
        };
        btn.setPreferredSize(new Dimension(150, 42));
        btn.setFont(new Font("Segoe UI", Font.BOLD, 14));
        btn.setContentAreaFilled(false); btn.setBorderPainted(false);
        btn.setFocusPainted(false);
        btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return btn;
    }
}
