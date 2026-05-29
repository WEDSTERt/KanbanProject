package com.service;

import com.entity.*;
import com.repository.*;
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
    private final NotificationRepository notificationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;
    private final TurnstileService turnstileService;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final SubgroupMemberRepository subgroupMemberRepository;
    private final TaskRepository taskRepository;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    @Value("${app.verification.ttl.hours:24}")
    private int verificationTtlHours;

    @Value("${app.verification.auto-delete.enabled:true}")
    private boolean autoDeleteEnabled;

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JavaMailSender mailSender,
                       TurnstileService turnstileService,
                       NotificationRepository notificationRepository,
                       ProjectRepository projectRepository,
                       ProjectMemberRepository projectMemberRepository,
                       SubgroupMemberRepository subgroupMemberRepository,
                       TaskRepository taskRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailSender = mailSender;
        this.turnstileService = turnstileService;
        this.notificationRepository = notificationRepository;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.subgroupMemberRepository = subgroupMemberRepository;
        this.taskRepository = taskRepository;
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
        String verificationUrl = frontendUrl + "/verify-email/" + token;

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

    @CacheEvict(value = {"users"}, key = "#id")
    @Transactional
    public User updateUser(Long id, String fullName, String email, String password) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (fullName != null) { user.setFullName(fullName); System.out.println("📝 Updated fullName to: " + fullName); }
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
        System.out.println("\n═══════════════════════════════════════════════════════════════");
        System.out.println("🗑️ DELETE USER PROCESS STARTED: User ID = " + id);
        System.out.println("═══════════════════════════════════════════════════════════════");

        if (!userRepository.existsById(id)) {
            System.out.println("❌ User not found");
            return false;
        }

        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            System.out.println("❌ Could not load user");
            return false;
        }

        System.out.println("📧 User: " + user.getEmail());

        // STEP 1: Удалить все уведомления
        System.out.println("\n[STEP 1] Deleting all notifications...");
        try {
            notificationRepository.deleteAllByUserId(id);
            System.out.println("✅ Deleted all notifications");
        } catch (Exception e) {
            System.err.println("⚠️ Warning: " + e.getMessage());
        }

        // STEP 2: Обработать проекты (если пользователь владелец)
        System.out.println("\n[STEP 2] Processing owned projects...");
        try {
            List<Project> ownedProjects = projectRepository.findByOwnerUserId(id);
            System.out.println("   Found " + ownedProjects.size() + " owned projects");

            for (Project project : ownedProjects) {
                System.out.println("   Processing project: " + project.getName() + " (ID: " + project.getId() + ")");

                // Найти другого админа в проекте
                List<ProjectMember> admins = projectMemberRepository.findAdminsByProjectId(project.getId(), id);
                
                if (!admins.isEmpty()) {
                    // Передать проект первому админу
                    ProjectMember newOwner = admins.get(0);
                    System.out.println("      ✓ Transferring to admin: " + newOwner.getUser().getFullName());
                    project.setOwner(newOwner.getUser());
                    projectRepository.save(project);
                } else {
                    // Удалить проект если нет других админов
                    System.out.println("      ✓ No other admins, deleting project...");
                    projectRepository.deleteById(project.getId());
                }
            }
        } catch (Exception e) {
            System.err.println("❌ Error processing owned projects: " + e.getMessage());
            e.printStackTrace();
        }

        // STEP 3: Удалить задачи созданные пользователем
        System.out.println("\n[STEP 3] Processing tasks created by user...");
        try {
            List<Task> createdTasks = taskRepository.findByCreatedByUserId(id);
            System.out.println("   Found " + createdTasks.size() + " created tasks");

            for (Task task : createdTasks) {
                // Передать задачу другому админу проекта
                Long projectId = task.getSubgroup().getProject().getId();
                List<ProjectMember> projectAdmins = projectMemberRepository.findAdminsByProjectId(projectId, id);

                if (!projectAdmins.isEmpty()) {
                    // Передать админу
                    task.setCreatedBy(projectAdmins.get(0).getUser());
                    System.out.println("      ✓ Task '" + task.getTitle() + "' transferred to: " + projectAdmins.get(0).getUser().getFullName());
                    taskRepository.save(task);
                } else {
                    // Если нет админов, найти кого-нибудь в проекте
                    List<ProjectMember> anyMembers = projectMemberRepository.findByProjectIdAndNotUserId(projectId, id);
                    if (!anyMembers.isEmpty()) {
                        task.setCreatedBy(anyMembers.get(0).getUser());
                        System.out.println("      ✓ Task '" + task.getTitle() + "' transferred to: " + anyMembers.get(0).getUser().getFullName());
                        taskRepository.save(task);
                    } else {
                        // Удалить задачу если нет никого
                        System.out.println("      ✓ No other members, deleting task: " + task.getTitle());
                        taskRepository.deleteById(task.getId());
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("❌ Error processing created tasks: " + e.getMessage());
            e.printStackTrace();
        }

        // STEP 4: Удалить из всех групп
        System.out.println("\n[STEP 4] Removing from all subgroups...");
        try {
            int removed = subgroupMemberRepository.deleteByUserId(id);
            System.out.println("✅ Removed from " + removed + " subgroups");
        } catch (Exception e) {
            System.err.println("❌ Error: " + e.getMessage());
        }

        // STEP 5: Удалить из всех проектов
        System.out.println("\n[STEP 5] Removing from all projects...");
        try {
            int removed = projectMemberRepository.deleteByUserId(id);
            System.out.println("✅ Removed from " + removed + " projects");
        } catch (Exception e) {
            System.err.println("❌ Error: " + e.getMessage());
        }

        // STEP 6: Удалить пользователя из задач (как исполнитель)
        System.out.println("\n[STEP 6] Removing from task assignees...");
        try {
            int removed = taskRepository.removeUserFromAllTaskAssignees(id);
            System.out.println("✅ Removed from " + removed + " task assignees");
        } catch (Exception e) {
            System.err.println("❌ Error: " + e.getMessage());
        }

        // STEP 7: Удалить самого пользователя
        System.out.println("\n[STEP 7] Deleting user from database...");
        try {
            userRepository.deleteById(id);
            System.out.println("✅ User deleted");
        } catch (Exception e) {
            System.err.println("❌ Error deleting user: " + e.getMessage());
            e.printStackTrace();
            return false;
        }

        System.out.println("\n═══════════════════════════════════════════════════════════════");
        System.out.println("✅ USER DELETION COMPLETED SUCCESSFULLY");
        System.out.println("═══════════════════════════════════════════════════════════════\n");
        return true;
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
        if (token == null || token.isEmpty()) {
            System.out.println("❌ Verification failed: token is null or empty");
            return false;
        }

        System.out.println("🔍 Verifying email with token: " + token);

        Optional<User> userOpt = userRepository.findByVerificationToken(token);
        if (userOpt.isEmpty()) {
            System.out.println("❌ Verification failed: user not found with token: " + token);
            System.out.println("   Searching in database for any matching token...");
            return false;
        }

        User user = userOpt.get();
        System.out.println("📧 Found user: " + user.getEmail());

        if (user.getVerificationTokenExpiry() == null) {
            System.out.println("❌ Verification failed: token expiry is null for user: " + user.getEmail());
            return false;
        }

        if (user.getVerificationTokenExpiry().isBefore(LocalDateTime.now())) {
            System.out.println("❌ Verification failed: token expired for user: " + user.getEmail());
            System.out.println("   Expiry time: " + user.getVerificationTokenExpiry());
            System.out.println("   Current time: " + LocalDateTime.now());
            return false;
        }

        if (user.getEmailVerified()) {
            System.out.println("⚠️ Email already verified for user: " + user.getEmail());
            return true;
        }

        user.setEmailVerified(true);
        userRepository.save(user);

        System.out.println("✅ Email verified successfully for user: " + user.getEmail());
        return true;
    }

    @Transactional
    public User findOrCreateOAuthUser(String email, String fullName, String provider) {
        return userRepository.findByEmail(email)
                .orElseGet(() -> {
                    String randomPassword = UUID.randomUUID().toString();
                    User newUser = new User(fullName, email, passwordEncoder.encode(randomPassword));
                    newUser.setEmailVerified(true);
                    newUser.setEmailNotificationsEnabled(true);
                    return userRepository.save(newUser);
                });
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

    @CacheEvict(value = "users", allEntries = true)
    @Transactional
    public User saveUser(User user) {
        return userRepository.save(user);
    }

    @Cacheable(value = "users", key = "#email")
    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
