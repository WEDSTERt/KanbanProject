package com.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.function.Function;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private Long expiration;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(Long userId, String email) {
        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey())
                .compact();
    }

    public Long extractUserId(String token) {
        if (token == null || token.trim().isEmpty()) return null;
        try {
            return Long.parseLong(extractClaim(token, Claims::getSubject));
        } catch (Exception e) {
            return null;
        }
    }

    public String extractEmail(String token) {
        if (token == null || token.trim().isEmpty()) return null;
        try {
            return extractClaim(token, claims -> claims.get("email", String.class));
        } catch (Exception e) {
            return null;
        }
    }

    public Date extractExpiration(String token) {
        if (token == null || token.trim().isEmpty()) return null;
        try {
            return extractClaim(token, Claims::getExpiration);
        } catch (Exception e) {
            return null;
        }
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        if (token == null || token.trim().isEmpty()) return null;
        final Claims claims = extractAllClaims(token);
        if (claims == null) return null;
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        if (token == null || token.trim().isEmpty()) return null;
        try {
            return Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (Exception e) {
            return null;
        }
    }

    public Boolean isTokenExpired(String token) {
        if (token == null || token.trim().isEmpty()) return true;
        Date expiration = extractExpiration(token);
        return expiration != null && expiration.before(new Date());
    }

    public Boolean validateToken(String token) {
        if (token == null || token.trim().isEmpty()) return false;
        return !isTokenExpired(token);
    }
}