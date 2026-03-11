package com.roomcraft.user;

import com.roomcraft.AppFrame;
import com.roomcraft.db.DatabaseManager;
import com.roomcraft.util.PasswordHasher;
import com.roomcraft.util.SessionManager;

import javax.swing.*;
import java.awt.*;

public class EditProfilePanel extends JPanel {

    private final AppFrame appFrame;
    private JTextField nameField;
    private JPasswordField newPassField, confirmPassField;
    private JLabel errorLabel, successLabel;

    public EditProfilePanel(AppFrame appFrame) {
        this.appFrame = appFrame;
        setBackground(new Color(15, 23, 42));
        setLayout(new GridBagLayout());
        buildUI();
    }

    @Override
    public void addNotify() {
        super.addNotify();
        if (SessionManager.currentUser != null) {
            nameField.setText(SessionManager.currentUser.name);
        }
        errorLabel.setText(" ");
        successLabel.setText(" ");
        newPassField.setText("");
        confirmPassField.setText("");
    }

    private void buildUI() {
        JPanel card = new JPanel(new GridBagLayout());
        card.setBackground(new Color(30, 41, 59));
        card.setBorder(BorderFactory.createEmptyBorder(35, 45, 35, 45));
        card.setPreferredSize(new Dimension(420, 400));

        GridBagConstraints c = new GridBagConstraints();
        c.gridx = 0; c.fill = GridBagConstraints.HORIZONTAL;
        c.insets = new Insets(7, 0, 7, 0);

        JLabel title = new JLabel("Edit Profile", SwingConstants.CENTER);
        title.setFont(new Font("Segoe UI", Font.BOLD, 26));
        title.setForeground(Color.WHITE);
        c.gridy = 0; card.add(title, c);

        c.gridy = 1; card.add(lbl("Full Name"), c);
        nameField = field();
        c.gridy = 2; card.add(nameField, c);

        c.gridy = 3; card.add(lbl("New Password (leave blank to keep)"), c);
        newPassField = passField();
        c.gridy = 4; card.add(newPassField, c);

        c.gridy = 5; card.add(lbl("Confirm New Password"), c);
        confirmPassField = passField();
        c.gridy = 6; card.add(confirmPassField, c);

        errorLabel = new JLabel(" ", SwingConstants.CENTER);
        errorLabel.setForeground(new Color(239, 68, 68));
        errorLabel.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        c.gridy = 7; card.add(errorLabel, c);

        successLabel = new JLabel(" ", SwingConstants.CENTER);
        successLabel.setForeground(new Color(16, 185, 129));
        successLabel.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        c.gridy = 8; card.add(successLabel, c);

        JButton saveBtn = styledBtn("Save Changes", new Color(16, 185, 129));
        saveBtn.addActionListener(e -> doSave());
        c.gridy = 9; card.add(saveBtn, c);

        JButton backBtn = styledBtn("← Back", new Color(71, 85, 105));
        backBtn.addActionListener(e -> appFrame.showPanel("USER_DASHBOARD"));
        c.gridy = 10; card.add(backBtn, c);

        add(card, new GridBagConstraints());
    }

    private void doSave() {
        String name = nameField.getText().trim();
        String pass = new String(newPassField.getPassword());
        String confirm = new String(confirmPassField.getPassword());

        if (name.isEmpty()) { errorLabel.setText("Name cannot be empty."); return; }
        if (!pass.isEmpty()) {
            if (pass.length() < 8) { errorLabel.setText("Password must be at least 8 characters."); return; }
            if (!pass.equals(confirm)) { errorLabel.setText("Passwords do not match."); return; }
        }

        String newHash = pass.isEmpty() ? null : PasswordHasher.hash(pass);
        boolean ok = DatabaseManager.updateUser(SessionManager.currentUser.id, name, newHash);
        if (ok) {
            SessionManager.currentUser.name = name;
            errorLabel.setText(" ");
            successLabel.setText("Profile updated successfully!");
        } else {
            errorLabel.setText("Failed to update profile.");
        }
    }

    private JLabel lbl(String t) {
        JLabel l = new JLabel(t);
        l.setForeground(new Color(148, 163, 184));
        l.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        return l;
    }

    private JTextField field() {
        JTextField f = new JTextField();
        f.setPreferredSize(new Dimension(320, 38));
        f.setBackground(new Color(51, 65, 85));
        f.setForeground(Color.WHITE); f.setCaretColor(Color.WHITE);
        f.setFont(new Font("Segoe UI", Font.PLAIN, 14));
        f.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(new Color(71, 85, 105)),
            BorderFactory.createEmptyBorder(5, 10, 5, 10)));
        return f;
    }

    private JPasswordField passField() {
        JPasswordField f = new JPasswordField();
        f.setPreferredSize(new Dimension(320, 38));
        f.setBackground(new Color(51, 65, 85));
        f.setForeground(Color.WHITE); f.setCaretColor(Color.WHITE);
        f.setFont(new Font("Segoe UI", Font.PLAIN, 14));
        f.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(new Color(71, 85, 105)),
            BorderFactory.createEmptyBorder(5, 10, 5, 10)));
        return f;
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
        btn.setPreferredSize(new Dimension(320, 42));
        btn.setFont(new Font("Segoe UI", Font.BOLD, 14));
        btn.setContentAreaFilled(false); btn.setBorderPainted(false);
        btn.setFocusPainted(false);
        btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return btn;
    }
}
