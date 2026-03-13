package com.roomcraft.service;

import com.roomcraft.dto.AuthDTOs;
import com.roomcraft.model.User;
import com.roomcraft.repository.UserRepository;
import com.roomcraft.security.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    public AuthDTOs.AuthResponse login(AuthDTOs.LoginRequest req) {
        User user = userRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid credentials");
        }

        if (!user.isActive()) {
            throw new RuntimeException("Account is disabled");
        }

        String token = jwtUtils.generateToken(user.getUsername(), user.getRole().name());
        return new AuthDTOs.AuthResponse(token, user.getUsername(), user.getEmail(),
                user.getRole().name(), user.getId());
    }

    public AuthDTOs.AuthResponse register(AuthDTOs.RegisterRequest req) {
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new RuntimeException("Username already taken");
        }
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        User user = User.builder()
                .username(req.getUsername())
                .email(req.getEmail())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .role(User.Role.USER)
                .active(true)
                .build();

        user = userRepository.save(user);
        String token = jwtUtils.generateToken(user.getUsername(), user.getRole().name());
        return new AuthDTOs.AuthResponse(token, user.getUsername(), user.getEmail(),
                user.getRole().name(), user.getId());
    }
}
