package com.config;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DotenvConfig {
    
    static {
        // Загружаем переменные из .env файла
        Dotenv dotenv = Dotenv.configure()
            .ignoreIfMissing()
            .load();
        
        // Устанавливаем системные переменные окружения
        dotenv.entries().forEach(entry -> 
            System.setProperty(entry.getKey(), entry.getValue())
        );
    }
}
