package com.studhub.user;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByLogin(String login);

    Optional<User> findById(Long id);

    boolean existsByEmail(String email);

    boolean existsByLogin(String login);

    List<User> findAllByEmailIn(List<String> emails);

    /**
     * Поиск по частичному совпадению логина, имени или фамилии.
     * LOWER() делает поиск регистронезависимым.
     * Pageable ограничивает выборку — передавайте PageRequest.of(0, limit).
     */
    @Query("""
        SELECT u FROM User u
        WHERE LOWER(u.login)     LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(u.firstName) LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(u.lastName)  LIKE LOWER(CONCAT('%', :q, '%'))
        ORDER BY u.login ASC
        """)
    List<User> searchByLoginOrName(@Param("q") String q, Pageable pageable);
}