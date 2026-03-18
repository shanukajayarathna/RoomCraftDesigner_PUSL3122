package com.roomcraft.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "furniture_models")
@EntityListeners(AuditingEntityListener.class)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FurnitureModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 50)
    private String category;

    private String subcategory;
    private String modelUrl;
    private String thumbnailUrl;
    private String topViewUrl;

    private Double width;
    private Double height;
    private Double depth;

    private String tags;

    @Builder.Default
    private boolean active = true;

    @Enumerated(EnumType.STRING)
    // Nullable to keep H2 schema migrations safe; application defaults to PUBLIC.
    @Column(nullable = true, length = 16)
    @Builder.Default
    private Visibility visibility = Visibility.PUBLIC;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @JsonIgnoreProperties({"projects", "passwordHash", "hibernateLazyInitializer"})
    private User uploadedBy;

    @CreatedDate
    private LocalDateTime createdAt;

    public enum Visibility {
        PUBLIC, PRIVATE
    }
}
