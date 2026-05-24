package com.service;

import com.entity.User;
import com.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;
    private final TurnstileService turnstileService;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    @Value("${app.verification.ttl.hours:24}")
    private int verificationTtlHours;

    @Value("${app.verification.auto-delete.enabled:true}")
    private boolean autoDeleteEnabled;

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JavaMailSender mailSender,
                       TurnstileService turnstileService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailSender = mailSender;
        this.turnstileService = turnstileService;
    }

    @CacheEvict(value = {"users", "currentUser"}, allEntries = true)
    @Transactional
    public User createUser(String fullName, String email, String password, String turnstileToken, String clientIp) {
        // 1. Проверка Turnstile
        if (!turnstileService.verifyToken(turnstileToken, clientIp)) {
            throw new RuntimeException("Bot verification failed. Please try again.");
        }

        // 2. Валидация email
        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new RuntimeException("Invalid email format");
        }

        // 3. Валидация имени
        if (!fullName.matches("^[А-ЯЁ][а-яё]+\\s[А-ЯЁ][а-яё]+$")) {
            throw new RuntimeException("Full name must be two Cyrillic words with capital first letters");
        }

        // 4. Валидация пароля
        if (!password.matches("^[A-Za-z0-9!\"#$%&'()*+,-./:;<=>?@\\[\\]^_]{6,}$")) {
            throw new RuntimeException("Password must be at least 6 characters, only Latin letters, digits and allowed special chars");
        }

        // 5. Проверка на существующего пользователя
        if (userRepository.findByEmail(email).isPresent()) {
            throw new RuntimeException("Email already exists");
        }

        // 6. Создание пользователя
        User user = new User(fullName, email, passwordEncoder.encode(password));
        user.setEmailVerified(false);
        user.setEmailNotificationsEnabled(true); // По умолчанию уведомления включены

        // 7. Генерация токена верификации
        String verificationToken = UUID.randomUUID().toString();
        user.setVerificationToken(verificationToken);
        user.setVerificationTokenExpiry(LocalDateTime.now().plusHours(24));

        User savedUser = userRepository.save(user);

        // 8. Отправляем письмо в отдельном потоке (НЕ БЛОКИРУЕТ ОТВЕТ)
        new Thread(() -> {
            try {
                sendVerificationEmail(email, verificationToken);
                System.out.println("✅ Verification email sent to: " + email);
            } catch (Exception e) {
                System.err.println("❌ Failed to send verification email to: " + email + " - " + e.getMessage());
            }
        }).start();

        return savedUser;
    }

    @Async
    public void sendVerificationEmailAsync(String email, String token) {
        try {
            sendVerificationEmail(email, token);
            System.out.println("✅ Verification email sent to: " + email);
        } catch (Exception e) {
            System.err.println("❌ Failed to send verification email to: " + email + " - " + e.getMessage());
        }
    }

    private void sendVerificationEmail(String email, String token) {
        String verificationUrl = frontendUrl + "/verify-email?token=" + token;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("Подтверждение email - Kanban Docky");
        message.setText(String.format(
                "Здравствуйте!\n\n" +
                        "Вы зарегистрировались на Kanban Docky. Для подтверждения email перейдите по ссылке:\n\n" +
                        "%s\n\n" +
                        "Ссылка действительна 24 часа.\n\n" +
                        "Если вы не регистрировались, просто проигнорируйте это письмо.\n\n" +
                        "С уважением,\n" +
                        "Команда Kanban Docky",
                verificationUrl
        ));

        mailSender.send(message);
    }

    @CacheEvict(value = {"users", "currentUser"}, allEntries = true)
    @Transactional
    public User updateUser(Long id, String fullName, String email, String password) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (fullName != null) user.setFullName(fullName);
        if (email != null) user.setEmail(email);
        if (password != null) user.setUserPassword(passwordEncoder.encode(password));
        // НЕ ТРОГАЕМ emailNotificationsEnabled здесь!
        return userRepository.save(user);
    }

    @CacheEvict(value = {"users", "currentUser"}, allEntries = true)
    @Transactional
    public User updateEmailNotifications(Long id, Boolean emailNotificationsEnabled) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setEmailNotificationsEnabled(emailNotificationsEnabled != null ? emailNotificationsEnabled : true);
        return userRepository.save(user);
    }

    @CacheEvict(value = {"users", "currentUser", "projects", "projectDetails"}, allEntries = true)
    @Transactional
    public boolean deleteUser(Long id) {
        if (userRepository.existsById(id)) {
            User user = userRepository.findById(id).orElse(null);
            if (user != null) {
                user.getProjectMemberships().clear();
                user.getOwnedProjects().clear();
                user.getSubgroupMemberships().clear();
                user.getAssignedTasks().clear();
                user.getCreatedTasks().clear();
                userRepository.save(user);
            }
            userRepository.deleteById(id);
            return true;
        }
        return false;
    }

    @Cacheable(value = "users", key = "#id")
    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }

    public List<User> findAll(Integer limit, Integer offset) {
        if (limit == null) limit = 100;
        if (offset == null) offset = 0;
        Pageable pageable = PageRequest.of(offset / limit, limit);
        return userRepository.findAll(pageable).getContent();
    }

    @Cacheable(value = "users", key = "#email")
    public User login(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!user.getEmailVerified()) {
            LocalDateTime expiryTime = user.getCreatedAt().plusHours(verificationTtlHours);
            if (LocalDateTime.now().isAfter(expiryTime)) {
                userRepository.delete(user);
                throw new RuntimeException("Your account has expired because email was not verified within " + verificationTtlHours + " hours. Please register again.");
            }
            throw new RuntimeException("Please verify your email before logging in. Verification link expires in " + verificationTtlHours + " hours.");
        }

        boolean passwordMatches = passwordEncoder.matches(password, user.getUserPassword());

        if (!passwordMatches) {
            throw new RuntimeException("Invalid email or password");
        }
        return user;
    }

    @Transactional
    public boolean verifyEmail(String token) {
        User user = userRepository.findByVerificationToken(token)
                .orElseThrow(() -> new RuntimeException("Invalid verification token"));

        if (user.getVerificationTokenExpiry().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Verification token has expired");
        }

        user.setEmailVerified(true);
        user.setVerificationToken(null);
        user.setVerificationTokenExpiry(null);
        userRepository.save(user);

        return true;
    }

    @Transactional
    public void resendVerificationEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getEmailVerified()) {
            throw new RuntimeException("Email already verified");
        }

        String newToken = UUID.randomUUID().toString();
        user.setVerificationToken(newToken);
        user.setVerificationTokenExpiry(LocalDateTime.now().plusHours(24));
        userRepository.save(user);

        sendVerificationEmailAsync(email, newToken);
    }

    @Scheduled(fixedDelayString = "${app.verification.cleanup.interval:21600000}")
    @Transactional
    public void deleteUnverifiedAccounts() {
        if (!autoDeleteEnabled) {
            return;
        }

        LocalDateTime expiryTime = LocalDateTime.now().minusHours(verificationTtlHours);
        List<User> expiredUsers = userRepository.findUnverifiedUsersOlderThan(expiryTime);

        if (!expiredUsers.isEmpty()) {
            System.out.println("🗑️ Удаление " + expiredUsers.size() + " неподтвержденных аккаунтов, созданных до " + expiryTime);
            userRepository.deleteAll(expiredUsers);
        }
    }

    @Transactional
    public int manuallyDeleteExpiredUsers() {
        LocalDateTime expiryTime = LocalDateTime.now().minusHours(verificationTtlHours);
        List<User> expiredUsers = userRepository.findUnverifiedUsersOlderThan(expiryTime);
        int count = expiredUsers.size();
        if (count > 0) {
            userRepository.deleteAll(expiredUsers);
            System.out.println("🗑️ Вручную удалено " + count + " неподтвержденных аккаунтов");
        }
        return count;
    }
}