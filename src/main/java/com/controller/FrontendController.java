package com.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Контроллер для обслуживания фронтенд маршрутов.
 * Гарантирует, что все фронтенд маршруты (кроме API) возвращают index.html
 */
@Controller
@RequestMapping
public class FrontendController {

    /**
     * Для всех фронтенд маршрутов возвращаем index.html,
     * чтобы React Router мог обработать маршрутизацию на клиенте
     */
    @GetMapping({
        "/",
        "/login",
        "/register",
        "/verify-email",
        "/verify-email-pending",
        "/account",
        "/settings",
        "/board",
        "/{path:[^\\.]*}",
        "/{path:[^\\.]*}/{subpath:[^\\.]*}"
    })
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}
