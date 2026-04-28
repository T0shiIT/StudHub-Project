package com.studhub.service;

import com.studhub.chat.Message;
import com.studhub.chat.MessageRepository;
import com.studhub.dto.MessageDto;
import com.studhub.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class MessageService {

    private final MessageRepository repo;

    public MessageService(MessageRepository repo) { this.repo = repo; }

    @Transactional
    public MessageDto send(User sender, User receiver, String content) {
        Message msg = new Message();
        msg.setSender(sender);
        msg.setReceiver(receiver);
        msg.setContent(content);
        return toDto(repo.save(msg));
    }

    public List<MessageDto> getConversation(User user1, User user2) {
        return repo.findBySenderAndReceiverOrReceiverAndSenderOrderBySentAt(
                        user1, user2, user1, user2).stream()
                .map(this::toDto).toList();
    }

    public List<MessageDto> getUnread(User receiver) {
        return repo.findByReceiverAndReadFalse(receiver).stream()
                .map(this::toDto).toList();
    }

    private MessageDto toDto(Message m) {
        return new MessageDto(m.getId(), m.getSender().getEmail(),
                m.getReceiver().getEmail(), m.getContent(),
                m.getSentAt(), m.isRead());
    }
}