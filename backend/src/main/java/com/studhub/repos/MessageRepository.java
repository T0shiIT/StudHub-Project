package com.studhub.chat;

import com.studhub.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findBySenderAndReceiverOrReceiverAndSenderOrderBySentAt(
            User user1, User user2, User user2Again, User user1Again);
    List<Message> findByReceiverAndReadFalse(User receiver);
}