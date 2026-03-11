package com.roomcraft.user;

import com.roomcraft.AppFrame;
import com.roomcraft.db.DatabaseManager;
import com.roomcraft.model.Design;
import com.roomcraft.util.SessionManager;

import javax.swing.*;
import java.awt.*;
import java.util.List;

public class UserDashboardPanel extends JPanel {

    private final AppFrame appFrame;
    private JLabel welcomeLabel;
    private JPanel recentPanel;

    public UserDashboardPanel(AppFrame appFrame) {
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
        if (SessionManager.currentUser != null) {
            welcomeLabel.setText("Welcome back, " + SessionManager.currentUser.name + " 👋");
            loadRecentDesigns();
        }
    }

    private void buildUI() {
        // Top bar
        JPanel topBar = new JPanel(new BorderLayout());
        topBar.setBackground(new Color(30, 41, 59));
        topBar.setBorder(BorderFactory.createEmptyBorder(15, 25, 15, 25));

        welcomeLabel = new JLabel("Welcome!", SwingConstants.LEFT);
        welcomeLabel.setFont(new Font("Segoe UI", Font.BOLD, 22));
        welcomeLabel.setForeground(Color.WHITE);
        topBar.add(welcomeLabel, BorderLayout.WEST);

        JButton logoutBtn = topBtn("Logout", new Color(239, 68, 68));
        logoutBtn.addActionListener(e -> {
            SessionManager.clear();
            appFrame.showPanel("WELCOME");
        });
        topBar.add(logoutBtn, BorderLayout.EAST);
        add(topBar, BorderLayout.NORTH);

        // Center: main action buttons
        JPanel center = new JPanel(new GridBagLayout());
        center.setBackground(new Color(15, 23, 42));

        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(15, 15, 15, 15);

        JButton newDesign = bigBtn("➕  New Design", new Color(59, 130, 246),
                "Start designing a new room");
        newDesign.addActionListener(e -> {
            SessionManager.currentDesign = null;
            SessionManager.currentRoom = null;
            appFrame.showPanel("ROOM_SETUP");
        });

        JButton myDesigns = bigBtn("📁  My Designs", new Color(139, 92, 246),
                "View and manage your saved designs");
        myDesigns.addActionListener(e -> appFrame.showPanel("MY_DESIGNS"));

        JButton editProfile = bigBtn("👤  Edit Profile", new Color(16, 185, 129),
                "Update your name or password");
        editProfile.addActionListener(e -> appFrame.showPanel("EDIT_PROFILE"));

        gbc.gridx = 0; gbc.gridy = 0; center.add(newDesign, gbc);
        gbc.gridx = 1; gbc.gridy = 0; center.add(myDesigns, gbc);
        gbc.gridx = 0; gbc.gridy = 1; center.add(editProfile, gbc);

        add(center, BorderLayout.CENTER);

        // Bottom: recent designs
        JPanel bottom = new JPanel(new BorderLayout());
        bottom.setBackground(new Color(20, 30, 50));
        bottom.setBorder(BorderFactory.createEmptyBorder(10, 25, 15, 25));

        JLabel recentTitle = new JLabel("Recent Designs");
        recentTitle.setFont(new Font("Segoe UI", Font.BOLD, 16));
        recentTitle.setForeground(new Color(148, 163, 184));
        bottom.add(recentTitle, BorderLayout.NORTH);

        recentPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 12, 8));
        recentPanel.setBackground(new Color(20, 30, 50));
        bottom.add(recentPanel, BorderLayout.CENTER);

        add(bottom, BorderLayout.SOUTH);
    }

    private void loadRecentDesigns() {
        recentPanel.removeAll();
        if (SessionManager.currentUser == null) return;
        List<Design> designs = DatabaseManager.getDesignsByUser(SessionManager.currentUser.id);
        int count = Math.min(3, designs.size());
        for (int i = 0; i < count; i++) {
            Design d = designs.get(i);
            JPanel card = new JPanel(new BorderLayout(5, 5));
            card.setBackground(new Color(30, 41, 59));
            card.setBorder(BorderFactory.createEmptyBorder(10, 14, 10, 14));
            card.setPreferredSize(new Dimension(180, 70));

            JLabel name = new JLabel(d.name);
            name.setFont(new Font("Segoe UI", Font.BOLD, 13));
            name.setForeground(Color.WHITE);
            card.add(name, BorderLayout.NORTH);

            String dateStr = d.dateCreated != null ? d.dateCreated.substring(0, Math.min(10, d.dateCreated.length())) : "";
            JLabel date = new JLabel(dateStr);
            date.setFont(new Font("Segoe UI", Font.PLAIN, 11));
            date.setForeground(new Color(100, 116, 139));
            card.add(date, BorderLayout.SOUTH);

            final Design design = d;
            card.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            card.addMouseListener(new java.awt.event.MouseAdapter() {
                @Override public void mouseClicked(java.awt.event.MouseEvent e) {
                    SessionManager.currentDesign = design;
                    appFrame.showPanel("WORKSPACE_2D");
                }
            });

            recentPanel.add(card);
        }
        if (designs.isEmpty()) {
            JLabel none = new JLabel("No designs yet. Create one!");
            none.setForeground(new Color(100, 116, 139));
            none.setFont(new Font("Segoe UI", Font.ITALIC, 13));
            recentPanel.add(none);
        }
        recentPanel.revalidate();
        recentPanel.repaint();
    }

    private JButton bigBtn(String text, Color bg, String tooltip) {
        JButton btn = new JButton() {
            @Override protected void paintComponent(Graphics g) {
                Graphics2D g2 = (Graphics2D) g.create();
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g2.setColor(getModel().isPressed() ? bg.darker() : (getModel().isRollover() ? bg.brighter() : bg));
                g2.fillRoundRect(0,0,getWidth(),getHeight(),16,16);
                g2.setColor(Color.WHITE); g2.setFont(getFont());
                FontMetrics fm = g2.getFontMetrics();
                g2.drawString(text,(getWidth()-fm.stringWidth(text))/2,
                    (getHeight()+fm.getAscent()-fm.getDescent())/2);
                g2.dispose();
            }
        };
        btn.setPreferredSize(new Dimension(220, 100));
        btn.setFont(new Font("Segoe UI", Font.BOLD, 16));
        btn.setToolTipText(tooltip);
        btn.setContentAreaFilled(false); btn.setBorderPainted(false);
        btn.setFocusPainted(false);
        btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return btn;
    }

    private JButton topBtn(String text, Color bg) {
        JButton btn = new JButton(text);
        btn.setBackground(bg);
        btn.setForeground(Color.WHITE);
        btn.setFont(new Font("Segoe UI", Font.BOLD, 13));
        btn.setBorder(BorderFactory.createEmptyBorder(7, 18, 7, 18));
        btn.setFocusPainted(false);
        btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return btn;
    }
}
