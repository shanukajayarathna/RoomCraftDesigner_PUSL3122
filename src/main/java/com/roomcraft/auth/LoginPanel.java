package com.roomcraft.auth;

import com.roomcraft.AppFrame;
import com.roomcraft.db.DatabaseManager;
import com.roomcraft.model.User;
import com.roomcraft.util.PasswordHasher;
import com.roomcraft.util.SessionManager;

import javax.swing.*;
import java.awt.*;

public class LoginPanel extends JPanel {

    private final AppFrame appFrame;
    private JTextField emailField;
    private JPasswordField passField;
    private JLabel errorLabel;

    public LoginPanel(AppFrame appFrame) {
        this.appFrame = appFrame;
        setBackground(new Color(15, 23, 42));
        buildUI();
    }

    private void buildUI() {
        JPanel card = new JPanel(new GridBagLayout());
        card.setBackground(new Color(30, 41, 59));
        card.setBorder(BorderFactory.createEmptyBorder(35, 45, 35, 45));
        card.setPreferredSize(new Dimension(400, 380));

        GridBagConstraints c = new GridBagConstraints();
        c.gridx = 0; c.fill = GridBagConstraints.HORIZONTAL;
        c.insets = new Insets(7, 0, 7, 0);

        JLabel title = new JLabel("Welcome Back 👋", SwingConstants.CENTER);
        title.setFont(new Font("Segoe UI", Font.BOLD, 26));
        title.setForeground(Color.WHITE);
        c.gridy = 0; card.add(title, c);

        JLabel hint = new JLabel("Default admin: admin@roomcraft.com / admin123", SwingConstants.CENTER);
        hint.setFont(new Font("Segoe UI", Font.ITALIC, 11));
        hint.setForeground(new Color(100, 116, 139));
        c.gridy = 1; card.add(hint, c);

        c.gridy = 2; card.add(lbl("Email"), c);
        emailField = styledField();
        c.gridy = 3; card.add(emailField, c);

        c.gridy = 4; card.add(lbl("Password"), c);
        passField = new JPasswordField();
        stylePassField(passField);
        c.gridy = 5; card.add(passField, c);

        errorLabel = new JLabel(" ", SwingConstants.CENTER);
        errorLabel.setForeground(new Color(239, 68, 68));
        errorLabel.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        c.gridy = 6; card.add(errorLabel, c);

        JButton loginBtn = btn("Login", new Color(59, 130, 246));
        loginBtn.addActionListener(e -> doLogin());
        // Allow pressing Enter to login
        passField.addActionListener(e -> doLogin());
        emailField.addActionListener(e -> doLogin());
        c.gridy = 7; card.add(loginBtn, c);

        JButton backBtn = btn("Back to Welcome", new Color(71, 85, 105));
        backBtn.addActionListener(e -> appFrame.showPanel("WELCOME"));
        c.gridy = 8; card.add(backBtn, c);

        setLayout(new GridBagLayout());
        add(card, new GridBagConstraints());
    }

    private void doLogin() {
        String email = emailField.getText().trim();
        String pass = new String(passField.getPassword());

        if (email.isEmpty() || pass.isEmpty()) {
            errorLabel.setText("Email and password are required.");
            return;
        }

        User user = DatabaseManager.getUserByEmail(email);
        if (user == null || !PasswordHasher.verify(pass, user.passwordHash)) {
            errorLabel.setText("Invalid email or password.");
            return;
        }

        SessionManager.currentUser = user;
        errorLabel.setText(" ");
        emailField.setText(""); passField.setText("");

        if ("admin".equals(user.role)) {
            appFrame.showPanel("ADMIN_DASHBOARD");
        } else {
            appFrame.showPanel("USER_DASHBOARD");
        }
    }

    private JLabel lbl(String text) {
        JLabel l = new JLabel(text);
        l.setForeground(new Color(148, 163, 184));
        l.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        return l;
    }

    private JTextField styledField() {
        JTextField f = new JTextField();
        f.setPreferredSize(new Dimension(310, 38));
        f.setBackground(new Color(51, 65, 85));
        f.setForeground(Color.WHITE); f.setCaretColor(Color.WHITE);
        f.setFont(new Font("Segoe UI", Font.PLAIN, 14));
        f.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new Color(71, 85, 105)),
                BorderFactory.createEmptyBorder(5, 10, 5, 10)));
        return f;
    }

    private void stylePassField(JPasswordField f) {
        f.setPreferredSize(new Dimension(310, 38));
        f.setBackground(new Color(51, 65, 85));
        f.setForeground(Color.WHITE); f.setCaretColor(Color.WHITE);
        f.setFont(new Font("Segoe UI", Font.PLAIN, 14));
        f.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new Color(71, 85, 105)),
                BorderFactory.createEmptyBorder(5, 10, 5, 10)));
    }

    private JButton btn(String text, Color bg) {
        JButton b = new JButton(text) {
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
        b.setPreferredSize(new Dimension(310, 42));
        b.setFont(new Font("Segoe UI", Font.BOLD, 14));
        b.setContentAreaFilled(false); b.setBorderPainted(false);
        b.setFocusPainted(false);
        b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return b;
    }
}
