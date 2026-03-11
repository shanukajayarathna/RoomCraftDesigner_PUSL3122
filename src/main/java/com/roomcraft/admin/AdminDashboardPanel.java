package com.roomcraft.admin;

import com.roomcraft.AppFrame;
import com.roomcraft.util.SessionManager;

import javax.swing.*;
import java.awt.*;

public class AdminDashboardPanel extends JPanel {

    private final AppFrame appFrame;
    private JLabel welcomeLabel;

    public AdminDashboardPanel(AppFrame appFrame) {
        this.appFrame = appFrame;
        setBackground(new Color(15, 23, 42));
        setLayout(new GridBagLayout());
        buildUI();
    }

    @Override
    public void addNotify() {
        super.addNotify();
        if (SessionManager.currentUser != null) {
            welcomeLabel.setText("Admin Panel — Welcome, " + SessionManager.currentUser.name);
        }
    }

    private void buildUI() {
        JPanel card = new JPanel(new GridBagLayout());
        card.setBackground(new Color(30, 41, 59));
        card.setBorder(BorderFactory.createEmptyBorder(40, 50, 40, 50));
        card.setPreferredSize(new Dimension(500, 420));

        GridBagConstraints c = new GridBagConstraints();
        c.gridx = 0; c.gridwidth = 1;
        c.fill = GridBagConstraints.HORIZONTAL;
        c.insets = new Insets(10, 0, 10, 0);

        welcomeLabel = new JLabel("Admin Panel", SwingConstants.CENTER);
        welcomeLabel.setFont(new Font("Segoe UI", Font.BOLD, 28));
        welcomeLabel.setForeground(Color.WHITE);
        c.gridy = 0; card.add(welcomeLabel, c);

        JLabel sub = new JLabel("Manage users, designs, and furniture library", SwingConstants.CENTER);
        sub.setFont(new Font("Segoe UI", Font.PLAIN, 14));
        sub.setForeground(new Color(100, 116, 139));
        c.gridy = 1; card.add(sub, c);

        c.gridy = 2; card.add(Box.createVerticalStrut(10), c);

        JButton usersBtn = adminBtn("👥  Manage Users", new Color(59, 130, 246));
        usersBtn.addActionListener(e -> {
            SessionManager.filterUserId = -1;
            appFrame.showPanel("MANAGE_USERS");
        });
        c.gridy = 3; card.add(usersBtn, c);

        JButton designsBtn = adminBtn("📐  Manage All Designs", new Color(139, 92, 246));
        designsBtn.addActionListener(e -> {
            SessionManager.filterUserId = -1;
            appFrame.showPanel("MANAGE_DESIGNS");
        });
        c.gridy = 4; card.add(designsBtn, c);

        JButton furnitureBtn = adminBtn("🪑  Furniture Library", new Color(16, 185, 129));
        furnitureBtn.addActionListener(e -> appFrame.showPanel("FURNITURE_LIBRARY"));
        c.gridy = 5; card.add(furnitureBtn, c);

        c.gridy = 6; card.add(Box.createVerticalStrut(10), c);

        JButton logoutBtn = adminBtn("Logout", new Color(239, 68, 68));
        logoutBtn.addActionListener(e -> {
            SessionManager.clear();
            appFrame.showPanel("WELCOME");
        });
        c.gridy = 7; card.add(logoutBtn, c);

        add(card, new GridBagConstraints());
    }

    private JButton adminBtn(String text, Color bg) {
        JButton btn = new JButton(text) {
            @Override protected void paintComponent(Graphics g) {
                Graphics2D g2 = (Graphics2D) g.create();
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g2.setColor(getModel().isPressed() ? bg.darker() : (getModel().isRollover() ? bg.brighter() : bg));
                g2.fillRoundRect(0,0,getWidth(),getHeight(),12,12);
                g2.setColor(Color.WHITE); g2.setFont(getFont());
                FontMetrics fm = g2.getFontMetrics();
                g2.drawString(getText(),(getWidth()-fm.stringWidth(getText()))/2,
                    (getHeight()+fm.getAscent()-fm.getDescent())/2);
                g2.dispose();
            }
        };
        btn.setPreferredSize(new Dimension(380, 50));
        btn.setFont(new Font("Segoe UI", Font.BOLD, 16));
        btn.setContentAreaFilled(false); btn.setBorderPainted(false);
        btn.setFocusPainted(false);
        btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return btn;
    }
}
