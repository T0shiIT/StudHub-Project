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

    @Query("""
        SELECT u FROM User u
        WHERE LOWER(u.login)     LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(u.firstName) LIKE LOWER(CONCAT('%', :q, '%'))
           OR LOWER(u.lastName)  LIKE LOWER(CONCAT('%', :q, '%'))
        ORDER BY u.login ASC
        """)
    List<User> searchByLoginOrName(@Param("q") String q, Pageable pageable);

    // ДОБАВИТЬ ЭТОТ МЕТОД:
    @Query("SELECT u FROM User u WHERE u.role IN ('STUDENT', 'TEACHER')")
    List<User> findAllStudentsAndTeachers();
}