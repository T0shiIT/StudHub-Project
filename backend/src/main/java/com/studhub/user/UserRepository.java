package com.studhub.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Optional;
import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByLogin(String login);
    Optional<User> findById(Long id);
    boolean existsByEmail(String email);
    boolean existsByLogin(String login);
    List<User> findAllByEmailIn(List<String> emails);

    // Новый метод: получает все уникальные названия групп (не null и не пустые)
    @Query("SELECT DISTINCT u.groupName FROM User u WHERE u.groupName IS NOT NULL AND u.groupName != ''")
    List<String> findDistinctGroupNames();
}