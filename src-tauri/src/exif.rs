use little_exif::exif_tag::ExifTag;
use little_exif::ifd::ExifTagGroup;
use little_exif::metadata::Metadata;
use std::path::Path;

#[tauri::command]
pub fn test_read_exif(paths: Vec<String>) -> Result<(), String> {
    let png_path = Path::new(&paths[0]);

    // Read in the metadata again & print it
    println!("\nPNG read result:");
    for tag in &Metadata::new_from_path(png_path).unwrap() {
        println!("{:?}", tag);
    }

    Ok(())
}

#[tauri::command]
pub fn write_rating(path: String, rating: u8) -> Result<(), String> {
    if 5 < rating {
        println!("Hohogeho");
        return Err(format!("Rating must be between 0 and 5, got {}", rating).to_string());
    }

    let png_path = Path::new(&path);

    // Create metadata structs & fill them
    let mut png_data = Metadata::new_from_path(&png_path).unwrap();

    // Set the rating tag
    png_data.set_tag(ExifTag::UnknownINT16U(
        vec![rating as u16],
        18246,
        ExifTagGroup::GENERIC,
    ));

    // Set the rating percent tag based on rating value
    let percent = match rating {
        0 => 0,
        1 => 1,
        2 => 25,
        3 => 50,
        4 => 75,
        5 => 99,
        _ => unreachable!(),
    };

    png_data.set_tag(ExifTag::UnknownINT16U(
        vec![percent],
        18249,
        ExifTagGroup::GENERIC,
    ));

    println!(
        "Writing rating...: {}: {}: {}",
        png_path.display(),
        rating,
        percent
    );
    // Write the metadata to the copies
    png_data
        .write_to_file(&png_path)
        .map_err(|e| e.to_string())?;

    println!("Wrote rating successfully");

    Ok(())
}
