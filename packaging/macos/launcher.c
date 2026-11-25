/* Native entry point for the Developer ID signed macOS app. */
#define _DARWIN_C_SOURCE
#include <mach-o/dyld.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#if defined(__arm64__) || defined(__aarch64__)
#define RUNTIME "aarch64"
#elif defined(__x86_64__)
#define RUNTIME "x86_64"
#else
#error Unsupported architecture
#endif

int main(int argc, char **argv)
{
    uint32_t path_size = 0;
    _NSGetExecutablePath(NULL, &path_size);
    char *executable = malloc(path_size);
    if (executable == NULL || _NSGetExecutablePath(executable, &path_size) != 0) {
        fputs("Productivity: the launcher path could not be resolved.\n", stderr);
        return 1;
    }
    char *contents = realpath(executable, NULL);
    free(executable);
    if (contents == NULL) {
        perror("Productivity launcher path");
        return 1;
    }
    /* Resolve Contents from Contents/MacOS/Productivity. */
    *strrchr(contents, '/') = '\0';
    char *macos = strrchr(contents, '/');
    if (macos == NULL || strcmp(macos, "/MacOS") != 0) {
        fputs("Productivity: launch the app from inside its bundle.\n", stderr);
        return 1;
    }
    *macos = '\0';

    char *python = NULL;
    char *script = NULL;
    char **arguments = calloc((size_t)argc + 4, sizeof(*arguments));
    if (arguments == NULL ||
        asprintf(&python, "%s/Resources/runtime-%s/bin/python3", contents, RUNTIME) < 0 ||
        asprintf(&script, "%s/Resources/app/desktop_unix.py", contents) < 0) {
        fputs("Productivity: could not allocate launcher arguments.\n", stderr);
        return 1;
    }
    arguments[0] = python;
    arguments[1] = "-B";
    arguments[2] = script;
    memcpy(arguments + 3, argv + 1, (size_t)(argc - 1) * sizeof(*arguments));
    execv(python, arguments);
    perror("Productivity could not start Python");
    return 1;
}
