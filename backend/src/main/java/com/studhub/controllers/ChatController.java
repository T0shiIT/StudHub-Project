package com.studhub.controller;

import com.studhub.chat.Message;
import com.studhub.dto.MessageDto;
import com.studhub.security.UserDetailsImpl;
import com.studhub.service.MessageService;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
public class ChatController {

    private final MessageService messageService;
    private final UserRepository userRepository;

    public ChatController(MessageService messageService, UserRepository userRepository) {
        this.messageService = messageService;
        this.userRepository = userRepository;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MessageDto send(@RequestBody SendRequest req, Authentication auth) {
        User sender = ((UserDetailsImpl) auth.getPrincipal()).getUser();
        User receiver = userRepository.findByEmail(req.receiverEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Получатель не найден"));
        return messageService.send(sender, receiver, req.content());
    }

    @GetMapping("/conversation")
    public List<MessageDto> getConversation(@RequestParam String withEmail, Authentication auth) {
        User current = ((UserDetailsImpl) auth.getPrincipal()).getUser();
        User other = userRepository.findByEmail(withEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return messageService.getConversation(current, other);
    }

    @GetMapping("/unread")
    public List<MessageDto> getUnread(Authentication auth) {
        User receiver = ((UserDetailsImpl) auth.getPrincipal()).getUser();
        return messageService.getUnread(receiver);
    }

    public record SendRequest(String receiverEmail, String content) {}
}