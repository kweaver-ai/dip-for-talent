#!/usr/bin/env python3
"""Build and package a DIP application."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict


def load_context(path: Path) -> Dict[str, Any]:
    """Load template context from a JSON or YAML file."""
    if not path.exists():
        raise FileNotFoundError(f"Context file not found: {path}")

    if path.suffix.lower() == ".json":
        return json.loads(path.read_text(encoding="utf-8"))

    try:
        import yaml  # type: ignore
    except ImportError as exc:  # pragma: no cover - depends on environment
        raise RuntimeError(
            "PyYAML is required to load non-JSON context files."
        ) from exc

    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def render_template(template_path: Path, context: Dict[str, Any]) -> str:
    """Render a single Jinja2 template file with the provided context."""
    try:
        from jinja2 import Template
    except ImportError as exc:  # pragma: no cover - depends on environment
        raise RuntimeError("Jinja2 is required to render templates.") from exc

    template_text = template_path.read_text(encoding="utf-8")
    return Template(template_text).render(**context)


def render_charts(
    template_dir: Path, output_dir: Path, context: Dict[str, Any]
) -> None:
    """Render chart templates and copy non-templated files to the output."""
    try:
        from jinja2 import Environment, FileSystemLoader
    except ImportError as exc:  # pragma: no cover - depends on environment
        raise RuntimeError("Jinja2 is required to render templates.") from exc

    env = Environment(loader=FileSystemLoader(str(template_dir)))
    render_paths = {
        Path("Chart.yaml.j2"),
        Path("values.yaml.j2"),
    }

    for template_path in template_dir.rglob("*"):
        if template_path.is_dir():
            continue

        relative_path = template_path.relative_to(template_dir)
        if relative_path in render_paths:
            output_path = output_dir / relative_path.with_suffix("")
            output_path.parent.mkdir(parents=True, exist_ok=True)
            template = env.get_template(relative_path.as_posix())
            rendered = template.render(**context)
            output_path.write_text(rendered, encoding="utf-8")
        else:
            output_path = output_dir / relative_path
            output_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(template_path, output_path)


def create_task_dir(cache_root: Path) -> Path:
    """Create and return a unique task directory under the cache root."""
    timestamp = datetime.now().strftime("%Y_%m_%d_%H_%M")
    task_dir = cache_root / timestamp
    if not task_dir.exists():
        task_dir.mkdir(parents=True)
        return task_dir

    counter = 1
    while True:
        candidate = cache_root / f"{timestamp}_{counter}"
        if not candidate.exists():
            candidate.mkdir(parents=True)
            return candidate
        counter += 1


def copy_dist(source: Path, destination: Path) -> None:
    """Copy the built dist directory into the task workspace."""
    if not source.exists():
        raise FileNotFoundError(f"dist directory not found: {source}")
    shutil.copytree(source, destination)


def run_command(command: list[str], cwd: Path | None = None) -> None:
    """Run a subprocess command and raise if it fails."""
    subprocess.run(command, check=True, cwd=cwd)


def build_dip_package(
    package_dir: Path, output_path: Path
) -> None:
    """Zip the package directory into a .dip archive."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in package_dir.rglob("*"):
            if file_path.is_dir():
                continue
            if file_path.resolve() == output_path.resolve():
                continue
            archive.write(file_path, file_path.relative_to(package_dir))


def main() -> None:
    """Entry point for building and packaging the DIP application."""
    parser = argparse.ArgumentParser(
        description="Build and package a DIP application."
    )
    parser.add_argument(
        "--os",
        default="linux",
        choices=["linux"],
        help="Target operating system.",
    )
    parser.add_argument(
        "--arch",
        required=True,
        choices=["amd64", "arm64"],
        help="Target architecture.",
    )

    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parents[1]
    os.chdir(base_dir)
    project_root = base_dir.parent
    context = load_context(base_dir / "config.yaml")

    name = context.get("name")
    tag = context.get("version")
    app_key = context.get("key")
    if not name or not tag or not app_key:
        raise KeyError("config.yaml must include name, version, and key.")

    task_dir = create_task_dir(base_dir / ".cache")

    run_command(["npm", "run", "build"], cwd=project_root)

    copy_dist(project_root / "dist", task_dir / "dist")

    nginx_rendered = render_template(base_dir / "templates/nginx.conf.j2", context)
    (task_dir / "nginx.conf").write_text(nginx_rendered, encoding="utf-8")

    manifest_rendered = render_template(
        base_dir / "templates/manifest.yaml.j2", context
    )
    manifest_path = task_dir / "package" / args.arch / "manifest.yaml"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(manifest_rendered, encoding="utf-8")

    application_key_path = task_dir / "package" / args.arch / "application.key"
    application_key_path.write_text(str(app_key), encoding="utf-8")

    dockerfile_rendered = render_template(
        base_dir / "templates/Dockerfile.j2", context
    )
    (task_dir / "Dockerfile").write_text(dockerfile_rendered, encoding="utf-8")

    charts_output = task_dir / "charts"
    render_charts(base_dir / "templates/charts", charts_output, context)

    images_dir = task_dir / "package" / args.arch / "packages" / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    charts_package_dir = task_dir / "package" / args.arch / "packages" / "charts"
    charts_package_dir.mkdir(parents=True, exist_ok=True)

    image_tag = f"registry.aishu.cn:15000/{name}:{tag}"
    run_command(
        [
            "docker",
            "buildx",
            "build",
            "--load",
            "--platform",
            f"linux/{args.arch}",
            "-t",
            image_tag,
            ".",
        ],
        cwd=task_dir,
    )
    run_command(
        [
            "skopeo",
            "copy",
            "--override-os",
            "linux",
            "--override-arch",
            args.arch,
            f"docker-daemon:{image_tag}",
            (
                f"oci-archive:{images_dir}/{name}-{tag}_{args.arch}.tar"
                f":{image_tag}"
            ),
        ]
    )
    run_command(["helm", "lint", str(charts_output)])
    run_command(
        [
            "helm",
            "package",
            str(charts_output),
            "--destination",
            str(charts_package_dir),
        ]
    )
    packaged_charts = list(charts_package_dir.glob("*.tgz"))
    if not packaged_charts:
        raise FileNotFoundError(
            f"No chart package found in {charts_package_dir}"
        )
    if len(packaged_charts) > 1:
        raise RuntimeError(
            f"Multiple chart packages found in {charts_package_dir}"
        )
    target_chart = charts_package_dir / f"{name}-{tag}_{args.arch}.tgz"
    if packaged_charts[0].resolve() != target_chart.resolve():
        shutil.move(str(packaged_charts[0]), target_chart)

    dip_output = task_dir / "package" / f"{name}-{tag}_{args.arch}.dip"
    build_dip_package(task_dir / "package" / args.arch, dip_output)


if __name__ == "__main__":
    main()
