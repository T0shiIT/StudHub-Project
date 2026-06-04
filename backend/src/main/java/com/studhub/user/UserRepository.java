package com.studhub.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);
    Optional<User> findByLogin(String login);
    boolean existsByEmail(String email);
    boolean existsByLogin(String login);

    // Для уведомлений
    @Query("SELECT u FROM User u WHERE u.role IN ('STUDENT', 'TEACHER') AND u.isBlocked = false")
    List<User> findAllStudentsAndTeachers();

    // Для GradeController – список уникальных названий групп
    @Query("SELECT DISTINCT u.groupName FROM User u WHERE u.groupName IS NOT NULL AND u.groupName != ''")
    List<String> findDistinctGroupNames();

    // Для GradeController – поиск пользователей по списку email
    List<User> findAllByEmailIn(List<String> emails);

    // ========== НОВЫЙ МЕТОД ДЛЯ ПОИСКА СТУДЕНТА ПО ИМЕНИ, ФАМИЛИИ И ГРУППЕ ==========
    @Query("SELECT u FROM User u WHERE u.firstName = :firstName AND u.lastName = :lastName AND u.groupName = :groupName")
    Optional<User> findByFirstNameAndLastNameAndGroupName(@Param("firstName") String firstName,
                                                          @Param("lastName") String lastName,
                                                          @Param("groupName") String groupName);
}