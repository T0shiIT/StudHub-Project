cmake_minimum_required(VERSION 3.16)

set(CMAKE_C_COMPILER gcc)
set(CMAKE_CXX_COMPILER g++)

project(StudHub_CPP)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FindPkgConfig)
add_compile_definitions(JWT_DISABLE_PICOJSON)

if(DEFINED CMAKE_TOOLCHAIN_FILE)
    message(STATUS "Using vcpkg toolchain: ${CMAKE_TOOLCHAIN_FILE}")
endif()

# pkg_check_modules(PQXX REQUIRED libpqxx)
# pkg_check_modules(LIBPQ REQUIRED libpq)
find_package(nlohmann_json CONFIG REQUIRED)

pkg_check_modules(PQXX REQUIRED libpqxx)
pkg_check_modules(LIBPQ REQUIRED libpq)

include_directories(
    handlers
    handlers/user
    handlers/new_user
    handlers/get_data
    handlers/schedule
    handlers/tests
    /usr/local/include
    ${LIBPQ_INCLUDE_DIRS}
    ${PQXX_INCLUDE_DIRS}
    user  # Чтобы компилятор видел users_permissions.h
)
# include_directories(/usr/local/include)
# include_directories(${LIBPQ_INCLUDE_DIRS} ${PQXX_INCLUDE_DIRS})
# link_directories(${LIBPQ_LIBRARY_DIRS})
add_executable(core
    main.cpp
    handlers/user/users_permissions.h
    handlers/new_user/new_user.cpp
    handlers/get_data/get_data.cpp
    handlers/schedule/schedule_json.cpp
    handlers/tests/user_set_role.cpp
)

target_link_libraries(core
    ${PQXX_LIBRARIES}
    ${LIBPQ_LIBRARIES}
    nlohmann_json::nlohmann_json
)