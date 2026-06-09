package com.studhub.user;

import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class GroupService {

    private static final List<String> AVAILABLE_GROUPS = List.of(
        "ПИ-251(1)",
        "ПИ-251(2)",
        "ПИ-252(1)",
        "ПИ-252(2)",
        "ИВТ-251(1)",
        "ИВТ-251(2)",
        "ИВТ-252(1)",
        "ИВТ-252(2)"
    );

    private final UserRepository userRepository;

    public GroupService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<String> getAllGroupNames() {
        return AVAILABLE_GROUPS;
    }

    public boolean groupExists(String groupName) {
        return AVAILABLE_GROUPS.contains(groupName);
    }
}